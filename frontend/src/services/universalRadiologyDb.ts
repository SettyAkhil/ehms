/**
 * Universal Radiology Center - Unified Operational Data & Workflow Service
 *
 * Implements authoritative state management for:
 * - Examination Scheduling & Room Suite Management
 * - Operational Scanning & Readiness
 * - Centralized Exception Queue
 * - Staff Assignments & Role Scopes
 * - Real-time Department Audit & Turnaround-Time (TAT) Analytics
 */

import { BillingDatabase, RadiologyStudyRecord } from "./billingDb"
import { RadiologyWorkflowDb, ExtendedRadiologyRecord } from "./radiologyWorkflowDb"
import { db } from "./db"
import { RADIOLOGY_MODALITIES } from "./radiologyTariffsData"
import { getCanonicalRadiologyModality } from "../utils/testClassifier"

export type RadiologyAppointmentStatus =
  | "Scheduled"
  | "Checked In"
  | "In Progress"
  | "Completed"
  | "Cancelled"
  | "No Show"

export interface RadiologyAppointment {
  id: string
  studyId: string
  patientId?: string
  patientName: string
  umr: string
  encounterId?: string
  modality: string
  studyName: string
  scheduledDate: string // YYYY-MM-DD
  scheduledTime: string // HH:MM
  durationMinutes: number
  room: string
  suiteId?: string
  technicianId?: string
  technicianName: string
  status: RadiologyAppointmentStatus
  priority: "Routine" | "Urgent" | "STAT"
  prepInstructions?: string
  notes?: string
  cancelledReason?: string
  createdAt: string
  updatedAt: string
}

export type SuiteOperationalStatus = "Available" | "In Use" | "Maintenance" | "Out of Service"

export interface RadiologySuite {
  id: string
  code: string
  name: string
  room: string
  modality: string
  status: SuiteOperationalStatus
  currentStudyId?: string
  notes?: string
  maintenanceExpectedUntil?: string
}

export type ExceptionCategory =
  | "Missing Approved Template"
  | "Ambiguous Template Mapping"
  | "Incomplete Examination"
  | "Scheduling Conflict"
  | "Equipment Down"
  | "Staff Assignment Conflict"
  | "Billing Status Inconsistency"
  | "Missing Patient Linkage"
  | "Report Overdue"
  | "AI Service Anomaly"

export type ExceptionSeverity = "Critical" | "High" | "Medium" | "Low"

export interface RadiologyException {
  id: string
  category: ExceptionCategory
  severity: ExceptionSeverity
  studyId?: string
  patientName?: string
  umr?: string
  description: string
  timestamp: string
  assignedOwner: string
  status: "Open" | "In Progress" | "Resolved"
  resolutionNotes?: string
  resolvedBy?: string
  resolvedAt?: string
}

export interface RadiologyAuditEvent {
  id: string
  timestamp: string
  studyId?: string
  patientName?: string
  action: string
  actor: string
  role: string
  details: string
  severity?: "Info" | "Warning" | "Critical"
}

const STORAGE_KEY_APPOINTMENTS = "hospai_rad_appointments_v1"
const STORAGE_KEY_SUITES = "hospai_rad_suites_v2"
const STORAGE_KEY_EXCEPTIONS = "hospai_rad_exceptions_v1"
const STORAGE_KEY_AUDIT = "hospai_rad_audit_v1"
const RAD_CHANNEL = "hospai_universal_radiology_channel"

const INITIAL_SUITES: RadiologySuite[] = [
  { id: "suite_xr_1", code: "XR-01", name: "Digital X-Ray Suite 1", room: "Room 101", modality: "X-Ray", status: "Available" },
  { id: "suite_xr_2", code: "XR-02", name: "Digital X-Ray Suite 2", room: "Room 102", modality: "X-Ray", status: "Available" },
  { id: "suite_ct_1", code: "CT-01", name: "64-Slice High-Speed CT", room: "CT Gantry 1", modality: "CT Scan", status: "In Use" },
  { id: "suite_ct_2", code: "CT-02", name: "128-Slice Dual-Source CT", room: "CT Gantry 2", modality: "CT Scan", status: "Available" },
  { id: "suite_mr_1", code: "MR-01", name: "3.0T High-Field MRI", room: "MRI Suite 1", modality: "MRI", status: "Available" },
  { id: "suite_us_1", code: "US-01", name: "4D Color Ultrasound Suite", room: "USG Room A", modality: "Ultrasound (USG)", status: "Available" },
  { id: "suite_dop_1", code: "DOP-01", name: "Vascular Doppler Suite", room: "USG Room B", modality: "Doppler", status: "Available" },
  { id: "suite_mam_1", code: "MAM-01", name: "Digital Breast Tomosynthesis", room: "Mammo Suite", modality: "Mammography", status: "Available" },
  { id: "suite_fl_1", code: "FL-01", name: "Digital Fluoroscopy & Contrast", room: "Room 105", modality: "Fluoroscopy / Contrast", status: "Available" },
  { id: "suite_nm_1", code: "NM-01", name: "PET-CT & SPECT Imaging", room: "Nuclear Med Bay", modality: "Nuclear Medicine", status: "Available" },
  { id: "suite_dexa_1", code: "DEXA-01", name: "Bone Densitometry Unit", room: "DEXA Lab", modality: "DEXA", status: "Available" },
  { id: "suite_dnt_1", code: "DNT-01", name: "Dental CBCT / OPG Suite", room: "Dental X-Ray", modality: "Dental", status: "Available" },
  { id: "suite_ir_1", code: "IR-01", name: "Interventional Angio / Cath Suite", room: "Cath Lab 2", modality: "Interventional Radiology", status: "Available" },
]

export class UniversalRadiologyDb {
  private static listeners: Set<() => void> = new Set()
  private static channel: BroadcastChannel | null = null

  private static initChannel() {
    if (typeof window === "undefined" || this.channel) return
    try {
      this.channel = new BroadcastChannel(RAD_CHANNEL)
      this.channel.onmessage = () => this.notify()
    } catch {}
  }

  public static subscribe(fn: () => void): () => void {
    this.initChannel()
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private static notify() {
    this.listeners.forEach((fn) => fn())
    try {
      this.channel?.postMessage("refresh")
    } catch {}
  }

  // ── Equipment Suites ──────────────────────────────────────────────────────────
  public static getSuites(): RadiologySuite[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SUITES)
      if (data) return JSON.parse(data)
    } catch {}
    this.saveSuites(INITIAL_SUITES)
    return INITIAL_SUITES
  }

  public static saveSuites(suites: RadiologySuite[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_SUITES, JSON.stringify(suites))
      this.notify()
    } catch {}
  }

  public static updateSuiteStatus(id: string, status: SuiteOperationalStatus, notes?: string): void {
    const suites = this.getSuites().map((s) => {
      if (s.id === id) {
        return { ...s, status, notes: notes !== undefined ? notes : s.notes }
      }
      return s
    })
    this.saveSuites(suites)
    this.logAudit({
      action: "Suite Status Changed",
      actor: "System / In-Charge",
      role: "Radiology Supervisor",
      details: `Equipment suite ${id} status transitioned to '${status}'`
    })
  }

  // ── Appointments & Scheduling ─────────────────────────────────────────────────
  public static getAppointments(): RadiologyAppointment[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_APPOINTMENTS)
      if (data) return JSON.parse(data)
    } catch {}
    return []
  }

  public static saveAppointments(appts: RadiologyAppointment[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_APPOINTMENTS, JSON.stringify(appts))
      this.notify()
    } catch {}
  }

  public static createAppointment(appt: Omit<RadiologyAppointment, "id" | "createdAt" | "updatedAt">): RadiologyAppointment {
    const appts = this.getAppointments()
    const newAppt: RadiologyAppointment = {
      ...appt,
      id: `RAD-APT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    appts.push(newAppt)
    this.saveAppointments(appts)

    // Update study in BillingDatabase if linked
    if (newAppt.studyId) {
      try {
        BillingDatabase.updateRadiologyStudy(newAppt.studyId, {
          room: newAppt.room,
        })
      } catch {}
    }

    this.logAudit({
      studyId: newAppt.studyId,
      patientName: newAppt.patientName,
      action: "Appointment Scheduled",
      actor: newAppt.technicianName || "Reception Desk",
      role: "Radiology Coordinator",
      details: `Scheduled ${newAppt.studyName} (${newAppt.modality}) on ${newAppt.scheduledDate} at ${newAppt.scheduledTime} in ${newAppt.room}`
    })

    return newAppt
  }

  public static updateAppointmentStatus(id: string, status: RadiologyAppointmentStatus, cancelReason?: string): void {
    const appts = this.getAppointments().map((a) => {
      if (a.id === id) {
        return {
          ...a,
          status,
          cancelledReason: cancelReason || a.cancelledReason,
          updatedAt: new Date().toISOString(),
        }
      }
      return a
    })
    this.saveAppointments(appts)
  }

  // ── Exceptions Queue ──────────────────────────────────────────────────────────
  public static getExceptions(): RadiologyException[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_EXCEPTIONS)
      if (data) return JSON.parse(data)
    } catch {}

    // Auto-derive exceptions from unverified/incomplete or overdue studies
    const derived = this.deriveExceptionsFromLiveStudies()
    this.saveExceptions(derived)
    return derived
  }

  public static saveExceptions(exceptions: RadiologyException[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_EXCEPTIONS, JSON.stringify(exceptions))
      this.notify()
    } catch {}
  }

  public static createException(ex: Omit<RadiologyException, "id" | "timestamp" | "status">): RadiologyException {
    const list = this.getExceptions()
    
    // Avoid duplicate exceptions when the same unresolved issue is detected repeatedly
    if (ex.studyId && ex.category) {
      const existing = list.find(
        (e) => e.studyId === ex.studyId && e.category === ex.category && e.status !== "Resolved"
      )
      if (existing) {
        return existing
      }
    }

    const newEx: RadiologyException = {
      ...ex,
      id: `EX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      status: "Open",
    }
    list.unshift(newEx)
    this.saveExceptions(list)
    return newEx
  }

  public static resolveException(id: string, notes: string, resolvedBy: string): void {
    const list = this.getExceptions().map((ex) => {
      if (ex.id === id) {
        return {
          ...ex,
          status: "Resolved" as const,
          resolutionNotes: notes,
          resolvedBy,
          resolvedAt: new Date().toISOString(),
        }
      }
      return ex
    })
    this.saveExceptions(list)
    this.logAudit({
      action: "Exception Resolved",
      actor: resolvedBy,
      role: "Radiology In-Charge",
      details: `Resolved exception '${id}': ${notes}`
    })
  }

  private static deriveExceptionsFromLiveStudies(): RadiologyException[] {
    const exceptions: RadiologyException[] = []
    const studies = RadiologyWorkflowDb.getStudies()

    studies.forEach((s) => {
      if (s.priority === "STAT" && !s.isPaid && s.billingStatus !== "Authorized Exception") {
        exceptions.push({
          id: `EX-STAT-${s.id}`,
          category: "Billing Status Inconsistency",
          severity: "Critical",
          studyId: s.id,
          patientName: s.patient,
          umr: s.umr,
          description: `STAT emergency study "${s.study}" has unverified billing without authorized financial override clearance.`,
          timestamp: s.ordered || new Date().toISOString(),
          assignedOwner: "Radiology Reception / Billing Desk",
          status: "Open"
        })
      }

      if (s.hasBillingDiscrepancy || (s.normalizedStatus === "DONE" && !s.isPaid && s.billingStatus !== "Authorized Exception")) {
        exceptions.push({
          id: `EX-DISCREPANCY-${s.id}`,
          category: "Billing Status Inconsistency",
          severity: "High",
          studyId: s.id,
          patientName: s.patient,
          umr: s.umr,
          description: `Billing discrepancy: Scan acquisition completed for "${s.study}" while billing remains pending (₹${s.price || 0}). Flagged for authorized financial resolution.`,
          timestamp: s.completedAt || s.ordered || new Date().toISOString(),
          assignedOwner: "Central Billing Cashier / Clinical Supervisor",
          status: "Open"
        })
      }

      if (s.normalizedStatus === "DONE" && s.normalizedReportStatus === "Awaiting Report") {
        const orderTime = new Date(s.ordered || Date.now()).getTime()
        const hoursAgo = (Date.now() - orderTime) / (1000 * 60 * 60)
        if (hoursAgo > 24) {
          exceptions.push({
            id: `EX-TAT-${s.id}`,
            category: "Report Overdue",
            severity: "High",
            studyId: s.id,
            patientName: s.patient,
            umr: s.umr,
            description: `Examination completed over 24 hours ago but diagnostic report remains pending transcription/authorization.`,
            timestamp: s.ordered || new Date().toISOString(),
            assignedOwner: s.radiologist || "Dr. Rajesh Sharma (HOD)",
            status: "Open"
          })
        }
      }
    })

    return exceptions
  }

  // ── Audit Events ──────────────────────────────────────────────────────────────
  public static getAuditEvents(): RadiologyAuditEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_AUDIT)
      if (data) {
        const parsed: RadiologyAuditEvent[] = JSON.parse(data)
        return parsed.sort((a, b) => {
          const timeA = new Date(a.timestamp || 0).getTime()
          const timeB = new Date(b.timestamp || 0).getTime()
          if (timeA !== timeB) return timeB - timeA // Latest department activity first
          return (b.id || "").localeCompare(a.id || "")
        })
      }
    } catch {}
    return [
      {
        id: "AUD-INIT-01",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        action: "Department System Initialized",
        actor: "System Administrator",
        role: "SuperAdmin",
        details: "Universal Radiology Center active with 11 standardized clinical modalities."
      }
    ]
  }

  public static logAudit(event: Omit<RadiologyAuditEvent, "id" | "timestamp">): void {
    const list = this.getAuditEvents()
    const newEv: RadiologyAuditEvent = {
      ...event,
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
    }
    list.unshift(newEv)
    try {
      localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(list.slice(0, 300)))
      this.notify()
    } catch {}
  }

  // ── Analytics & KPI Engine ────────────────────────────────────────────────────
  public static getDepartmentAnalytics(dateRange: "today" | "7days" | "30days" = "7days") {
    const allStudies = RadiologyWorkflowDb.getStudies()
    const appointments = this.getAppointments()
    const exceptions = this.getExceptions()
    const suites = this.getSuites()

    const now = Date.now()
    const msMap = {
      today: 24 * 60 * 60 * 1000,
      "7days": 7 * 24 * 60 * 60 * 1000,
      "30days": 30 * 24 * 60 * 60 * 1000,
    }
    const cutoff = now - msMap[dateRange]

    // Filter studies strictly within the selected date range using actual persisted order creation timestamp
    const studies = allStudies.filter((s) => {
      const ts = RadiologyWorkflowDb.getOrderCreationTimestamp(s)
      return ts >= cutoff || ts === 0
    })

    const totalStudies = studies.length
    const completedStudies = studies.filter((s) => s.normalizedStatus === "DONE").length
    const finalizedReports = studies.filter((s) => s.normalizedReportStatus === "Finalized").length
    const draftReports = studies.filter((s) => s.normalizedReportStatus === "Draft").length
    const awaitingReports = studies.filter((s) => s.normalizedStatus === "DONE" && s.normalizedReportStatus === "Awaiting Report").length
    const inProgressScanning = studies.filter((s) => s.normalizedStatus === "IN PROGRESS").length
    const openExceptions = exceptions.filter((e) => e.status !== "Resolved").length

    // Modality breakdown for studies in this date range
    const modalityCounts: Record<string, number> = {}
    RADIOLOGY_MODALITIES.forEach((m) => { modalityCounts[m] = 0 })
    studies.forEach((s) => {
      const matched = getCanonicalRadiologyModality(s)
      modalityCounts[matched] = (modalityCounts[matched] || 0) + 1
    })

    // Actual Turnaround Time (TAT) Calculations from persisted timestamps
    let totalOrderToScanMinutes = 0
    let countOrderToScan = 0
    let totalScanToReportMinutes = 0
    let countScanToReport = 0
    const totalTatMinutesList: number[] = []

    studies.forEach((s) => {
      const orderTs = RadiologyWorkflowDb.getOrderCreationTimestamp(s)
      const scanCompletedTs = s.scanningCompletedAt || s.completedAt ? new Date(s.scanningCompletedAt || s.completedAt!).getTime() : 0
      const finalizedTs = s.finalizedAt ? new Date(s.finalizedAt).getTime() : 0

      if (orderTs > 0 && scanCompletedTs > orderTs) {
        const diffMins = Math.round((scanCompletedTs - orderTs) / (1000 * 60))
        if (diffMins > 0 && diffMins < 1440 * 7) {
          totalOrderToScanMinutes += diffMins
          countOrderToScan++
        }
      }

      if (scanCompletedTs > 0 && finalizedTs > scanCompletedTs) {
        const diffMins = Math.round((finalizedTs - scanCompletedTs) / (1000 * 60))
        if (diffMins > 0 && diffMins < 1440 * 7) {
          totalScanToReportMinutes += diffMins
          countScanToReport++
        }
      }

      if (orderTs > 0 && finalizedTs > orderTs) {
        const diffMins = Math.round((finalizedTs - orderTs) / (1000 * 60))
        if (diffMins > 0 && diffMins < 1440 * 14) {
          totalTatMinutesList.push(diffMins)
        }
      }
    })

    const avgOrderToScanMinutes = countOrderToScan > 0 ? Math.round(totalOrderToScanMinutes / countOrderToScan) : 0
    const avgScanToReportMinutes = countScanToReport > 0 ? Math.round(totalScanToReportMinutes / countScanToReport) : 0
    const overallTatMinutes = avgOrderToScanMinutes + avgScanToReportMinutes

    // Chronological date-based throughput distribution:
    // Group examinations by day, sorted chronologically from oldest to newest
    const daysCount = dateRange === "today" ? 1 : dateRange === "7days" ? 7 : 30
    const chronologicalTrend: { date: string; label: string; count: number; completed: number; finalized: number }[] = []

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000)
      const dateKey = d.toISOString().split("T")[0]
      const label = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })

      const dayStudies = studies.filter((s) => {
        const ts = RadiologyWorkflowDb.getOrderCreationTimestamp(s)
        if (!ts) return false
        return new Date(ts).toISOString().split("T")[0] === dateKey
      })

      chronologicalTrend.push({
        date: dateKey,
        label,
        count: dayStudies.length,
        completed: dayStudies.filter((s) => s.normalizedStatus === "DONE").length,
        finalized: dayStudies.filter((s) => s.normalizedReportStatus === "Finalized").length,
      })
    }

    // Median TAT
    totalTatMinutesList.sort((a, b) => a - b)
    const medianMins = totalTatMinutesList.length > 0
      ? totalTatMinutesList[Math.floor(totalTatMinutesList.length / 2)]
      : 0
    const medianTatHours = Math.floor(medianMins / 60)
    const medianTatRemMins = medianMins % 60
    const medianTatStr = medianMins > 0
      ? (medianTatHours > 0 ? `${medianTatHours}h ${medianTatRemMins}m` : `${medianTatRemMins} mins`)
      : "—"

    return {
      dateRange,
      totalStudies,
      completedStudies,
      finalizedReports,
      draftReports,
      awaitingReports,
      inProgressScanning,
      openExceptions,
      modalityCounts,
      chronologicalTrend,
      suitesInUse: suites.filter((s) => s.status === "In Use").length,
      suitesAvailable: suites.filter((s) => s.status === "Available").length,
      turnaroundTime: {
        orderToScan: countOrderToScan > 0 ? `${avgOrderToScanMinutes} mins` : "—",
        scanToReport: countScanToReport > 0 ? `${avgScanToReportMinutes} mins` : "—",
        overall: overallTatMinutes > 0 ? `${Math.floor(overallTatMinutes / 60)}h ${overallTatMinutes % 60}m` : "—",
        medianTat: medianTatStr,
      }
    }
  }
}

export const RadiologyDatabase = UniversalRadiologyDb
export type RadiologyDatabase = UniversalRadiologyDb

