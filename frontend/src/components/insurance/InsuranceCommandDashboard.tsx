import React, { useMemo, useState } from "react"
import {
  Shield,
  Users,
  Clock,
  FileText,
  CheckCircle2,
  IndianRupee,
  Calendar,
  RefreshCw,
  Download,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Upload,
  MoreVertical,
  Activity,
  Wallet,
  Mail,
  ChevronRight,
  Zap,
  ChevronLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  BookOpen,
} from "lucide-react"
import { inr, fmtDate, useCases, useNotify, btn, StatusPill } from "./ui"
import { InsuranceEngineService, STATUS_META } from "../../services/insuranceDb"
import type { ComprehensiveClaimRecord } from "../../types/insurance"
import NewCaseModal from "./NewCaseModal"
import InsuranceSopModal from "./InsuranceSopModal"

// Insurer Logo Badges
const INSURER_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  "Care Health Insurance": { bg: "bg-amber-400", text: "text-blue-950 font-black", label: "CARE" },
  "Care Health": { bg: "bg-amber-400", text: "text-blue-950 font-black", label: "CARE" },
  "Star Health & Allied Insurance": { bg: "bg-sky-900", text: "text-white font-black", label: "STAR" },
  "Star Health": { bg: "bg-sky-900", text: "text-white font-black", label: "STAR" },
  "ICICI Lombard General Insurance": { bg: "bg-amber-700", text: "text-white font-black", label: "ICICI" },
  "ICICI Lombard": { bg: "bg-amber-700", text: "text-white font-black", label: "ICICI" },
  "HDFC ERGO General Insurance": { bg: "bg-red-600", text: "text-white font-black", label: "HDFC" },
  "FHPL (Family Health Plan TPA)": { bg: "bg-purple-600", text: "text-white font-black", label: "FHPL" },
  "Medi Assist TPA": { bg: "bg-teal-600", text: "text-white font-black", label: "MEDI" },
}

// Removed hardcoded DEMO_DASHBOARD_CASES to ensure everything is fully dynamic

// Sparkline Mini Bar Component
function SparklineBars({ heights, color }: { heights: number[]; color: string }) {
  return (
    <div className="flex items-end gap-1 h-8 shrink-0">
      {heights.map((h, i) => (
        <div key={i} className={`w-1.5 rounded-xs ${color}`} style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

export default function InsuranceCommandDashboard({
  onNavigate,
}: {
  onNavigate: (page: string, caseId?: string) => void
}) {
  const storeCases = useCases()
  const { notify, toastNode } = useNotify()
  const [adding, setAdding] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedInsurer, setSelectedInsurer] = useState("")
  const [selectedWard, setSelectedWard] = useState("")
  const [selectedStage, setSelectedStage] = useState("")
  const [sopModalOpen, setSopModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      notify("Insurance Command Dashboard refreshed cleanly.", "success")
    }, 500)
  }

  // Filtered rows for the table
  const tableRows = useMemo(() => {
    let list = storeCases.map((c) => {
      const meta = STATUS_META[c.status] || { label: c.status, tone: "blue", group: "Pre-Auth" }
      return {
        id: c.id,
        patientName: c.patientName,
        patientId: c.patientId || c.mrn || "UHID-9920",
        ward: c.encounterType || "ICU",
        wardColor: c.encounterType === "ICU" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-blue-100 text-blue-800 border-blue-200",
        avatarBg: "bg-blue-600 text-white",
        insurerName: c.policy.insurerName,
        admissionDetails: `${c.encounterType || "ICU"} - ${fmtDate(c.admissionDate)}`,
        doctor: c.preAuth?.treatingDoctor || "Consulting Specialist",
        stage: meta.group,
        step: c.status === "CLAIM_SUBMITTED" ? "7/8" : c.status === "PREAUTH_APPROVED" ? "4/8" : "3/8",
        progressPct: c.status === "CLAIM_SUBMITTED" ? 87.5 : c.status === "PREAUTH_APPROVED" ? 50 : 37.5,
        status: meta.label,
        rawStatus: c.status,
        amount: c.finalClaimAmount || c.preAuth?.requestedAmount || c.totalHospitalBill || 0,
        nextAction: c.approvedPreAuthAmount === 0 ? "Follow up with insurer" : "Upload discharge papers and send claim",
        updated: fmtDate(c.updatedAt || c.createdAt),
      }
    })

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((r) =>
        r.patientName.toLowerCase().includes(q) ||
        r.patientId.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.insurerName.toLowerCase().includes(q)
      )
    }

    if (selectedInsurer) {
      list = list.filter((r) => r.insurerName.includes(selectedInsurer))
    }

    if (selectedWard) {
      list = list.filter((r) => r.ward === selectedWard)
    }

    return list
  }, [storeCases, searchQuery, selectedInsurer, selectedWard])

  const handleResetFilters = () => {
    setSearchQuery("")
    setSelectedInsurer("")
    setSelectedWard("")
    setSelectedStage("")
  }

  const dashboardStats = useMemo(() => {
    const admitted = storeCases.filter((c) => c.status === "TREATMENT_IN_PROGRESS" || c.status === "PREAUTH_APPROVED").length
    const pendingPreauth = storeCases.filter((c) => c.status.startsWith("PREAUTH")).length
    const enhancements = storeCases.filter((c) => c.status === "PREAUTH_QUERY" || c.status === "CLAIM_QUERY_RAISED").length
    const readyToClaim = storeCases.filter((c) => c.status === "FINAL_BILL_READY" || c.status === "DISCHARGE_INITIATED").length
    const outstanding = storeCases.reduce((sum, c) => sum + (c.finalClaimAmount || c.preAuth?.requestedAmount || c.totalHospitalBill || 0), 0)

    // Outstanding by insurer
    const insurerMap: Record<string, { count: number; amount: number }> = {}
    storeCases.forEach((c) => {
      const name = c.policy?.insurerName || "Other"
      const amt = c.finalClaimAmount || c.preAuth?.requestedAmount || c.totalHospitalBill || 0
      if (!insurerMap[name]) insurerMap[name] = { count: 0, amount: 0 }
      insurerMap[name].count++
      insurerMap[name].amount += amt
    })
    const insurerList = Object.entries(insurerMap).map(([name, data]) => {
      const badge = INSURER_BADGES[name] || { bg: "bg-slate-700", text: "text-white font-bold", label: name.slice(0, 2).toUpperCase() }
      return {
        name,
        cases: `${data.count} case${data.count > 1 ? "s" : ""}`,
        amount: inr(data.amount),
        tag: badge.label,
        bg: `${badge.bg} ${badge.text}`,
      }
    })

    // My tasks (cases needing actions: queries, pending preauth, pending billing)
    const taskList = storeCases
      .filter((c) => c.status.includes("QUERY") || c.status === "PREAUTH_SUBMITTED" || c.status === "DISCHARGE_INITIATED")
      .slice(0, 4)
      .map((c) => {
        let taskTitle = `Review pre-auth: ${c.patientName}`
        let taskDesc = `${c.policy.insurerName} — pending response`
        let due = "Today"
        let tone = "amber"
        if (c.status.includes("QUERY")) {
          taskTitle = `Respond to query: ${c.patientName}`
          taskDesc = `Query raised by ${c.policy.insurerName}`
          due = "Action Required"
          tone = "rose"
        } else if (c.status === "DISCHARGE_INITIATED") {
          taskTitle = `Upload discharge papers: ${c.patientName}`
          taskDesc = `Final bill ready for submission`
          due = "Today"
          tone = "blue"
        }
        return {
          id: c.id,
          title: taskTitle,
          desc: taskDesc,
          due,
          tone,
        }
      })

    // Claim Stage Distribution
    const total = storeCases.length
    const stagePreauth = storeCases.filter((c) => c.status.startsWith("PREAUTH")).length
    const stageClaim = storeCases.filter((c) => c.status === "CLAIM_SUBMITTED" || c.status === "CLAIM_QUERY_RAISED").length
    const stageDischarge = storeCases.filter((c) => c.status === "DISCHARGE_INITIATED" || c.status === "FINAL_BILL_READY").length
    const stageOther = total - stagePreauth - stageClaim - stageDischarge

    const pctPreauth = total > 0 ? Math.round((stagePreauth / total) * 100) : 0
    const pctClaim = total > 0 ? Math.round((stageClaim / total) * 100) : 0
    const pctDischarge = total > 0 ? Math.round((stageDischarge / total) * 100) : 0
    const pctOther = total > 0 ? Math.max(0, 100 - pctPreauth - pctClaim - pctDischarge) : 0

    return {
      admitted,
      pendingPreauth,
      enhancements,
      readyToClaim,
      outstanding,
      insurerList,
      taskList,
      totalCases: total,
      stagePreauth,
      stageClaim,
      stageDischarge,
      stageOther,
      pctPreauth,
      pctClaim,
      pctDischarge,
      pctOther,
    }
  }, [storeCases])

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-y-auto">
      {toastNode}
      {adding && (
        <NewCaseModal
          notify={notify}
          onClose={() => setAdding(false)}
          onOpened={(id) => {
            setAdding(false)
            onNavigate("case", id)
          }}
        />
      )}

      <div className="p-6 max-w-[1750px] mx-auto w-full space-y-5">
        {/* ── 1. PAGE TITLE & HEADER CONTROLS ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Shield size={22} className="fill-white/20" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Insurance Command</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Live overview of all TPA &amp; cashless cases requiring action
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date Range Picker Pill */}
            <div className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 flex items-center gap-2 text-xs font-semibold text-slate-700 shadow-2xs">
              <Calendar size={14} className="text-slate-400" />
              <span>01 Sept 2026 - 01 Oct 2026</span>
            </div>

            {/* Refresh */}
            <button
              type="button"
              onClick={handleRefresh}
              className="bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-blue-600" : "text-slate-500"} />
              <span>Refresh</span>
            </button>

            {/* Dept Rules & Eligibility SOPs Button */}
            <button
              type="button"
              onClick={() => setSopModalOpen(true)}
              className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/90 rounded-xl px-3.5 py-2 text-xs font-bold text-indigo-800 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <BookOpen size={14} className="text-indigo-600" />
              <span>Dept Rules &amp; SOPs</span>
            </button>

            {/* Export */}
            <button
              type="button"
              onClick={() => notify("Exporting Cashless Summary Report (PDF/Excel)…", "success")}
              className="bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Download size={14} className="text-slate-500" />
              <span>Export</span>
            </button>

            {/* New Pre-Auth Button */}
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              <span>New Pre-Auth</span>
            </button>
          </div>

          <InsuranceSopModal isOpen={sopModalOpen} onClose={() => setSopModalOpen(false)} />
        </div>

        {/* ── 2. TOP 5 EXECUTIVE KPI STAT CARDS WITH SPARKLINES ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* KPI 1: Insured Admitted */}
          <div
            onClick={() => onNavigate("claims")}
            className="bg-white hover:bg-blue-50/30 border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                  <Users size={16} />
                </div>
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900 transition-colors truncate">Insured Admitted</span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">{dashboardStats.admitted}</span>
                <span className="inline-flex items-center text-[10.5px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Active cashless cases</p>
            </div>
            <SparklineBars heights={dashboardStats.admitted > 0 ? [35, 60, 45, 80, 100] : [0, 0, 0, 0, 0]} color="bg-blue-400" />
          </div>

          {/* KPI 2: Pre-Auth Pending */}
          <div
            onClick={() => onNavigate("preauth")}
            className="bg-white hover:bg-amber-50/30 border border-slate-200/90 hover:border-amber-300 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                  <Clock size={16} />
                </div>
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900 transition-colors truncate">Pre-Auth Pending</span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">{dashboardStats.pendingPreauth}</span>
                <span className="inline-flex items-center text-[10.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                  Pending
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Awaiting insurer decision</p>
            </div>
            <SparklineBars heights={dashboardStats.pendingPreauth > 0 ? [20, 50, 40, 75, 90] : [0, 0, 0, 0, 0]} color="bg-amber-400" />
          </div>

          {/* KPI 3: Enhancements */}
          <div
            onClick={() => onNavigate("claims")}
            className="bg-white hover:bg-purple-50/30 border border-slate-200/90 hover:border-purple-300 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                  <FileText size={16} />
                </div>
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900 transition-colors truncate">Enhancements</span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">{dashboardStats.enhancements}</span>
                <span className="inline-flex items-center text-[10.5px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                  Queries
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Cases need additional docs</p>
            </div>
            <SparklineBars heights={dashboardStats.enhancements > 0 ? [80, 60, 50, 40, 30] : [0, 0, 0, 0, 0]} color="bg-purple-400" />
          </div>

          {/* KPI 4: Ready to Claim */}
          <div
            onClick={() => onNavigate("claims")}
            className="bg-white hover:bg-emerald-50/30 border border-slate-200/90 hover:border-emerald-300 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900 transition-colors truncate">Ready to Claim</span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">{dashboardStats.readyToClaim}</span>
                <span className="inline-flex items-center text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                  Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Documents verified</p>
            </div>
            <SparklineBars heights={dashboardStats.readyToClaim > 0 ? [30, 45, 60, 75, 95] : [0, 0, 0, 0, 0]} color="bg-emerald-400" />
          </div>

          {/* KPI 5: Outstanding Amount */}
          <div
            onClick={() => onNavigate("settlements")}
            className="bg-white hover:bg-rose-50/30 border border-slate-200/90 hover:border-rose-300 rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-3 transition-all cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors flex items-center justify-center shrink-0">
                  <IndianRupee size={16} />
                </div>
                <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900 transition-colors truncate">Outstanding Amount</span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">{inr(dashboardStats.outstanding)}</span>
                <span className="inline-flex items-center text-[10.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                  Total
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Across all active claims</p>
            </div>
            <SparklineBars heights={dashboardStats.outstanding > 0 ? [40, 55, 70, 85, 100] : [0, 0, 0, 0, 0]} color="bg-rose-400" />
          </div>
        </div>

        {/* ── 3. QUICK NAVIGATION ACTION STRIP ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="bg-white hover:bg-blue-50/50 border border-slate-200/90 hover:border-blue-200 rounded-2xl p-3.5 text-left shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Plus size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">New Pre-Auth</div>
                <div className="text-[11px] text-slate-400">Create a new pre-authorization</div>
              </div>
            </div>
            <ChevronRight size={15} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("intake")}
            className="bg-white hover:bg-emerald-50/50 border border-slate-200/90 hover:border-emerald-200 rounded-2xl p-3.5 text-left shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Activity size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Patient Intake</div>
                <div className="text-[11px] text-slate-400">Verify patient &amp; policy eligibility</div>
              </div>
            </div>
            <ChevronRight size={15} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("claims")}
            className="bg-white hover:bg-purple-50/50 border border-slate-200/90 hover:border-purple-200 rounded-2xl p-3.5 text-left shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <FileText size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Claim Desk</div>
                <div className="text-[11px] text-slate-400">Manage claims &amp; submit</div>
              </div>
            </div>
            <ChevronRight size={15} className="text-slate-300 group-hover:text-purple-600 transition-colors" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("settlements")}
            className="bg-white hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-200 rounded-2xl p-3.5 text-left shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Wallet size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Settlements</div>
                <div className="text-[11px] text-slate-400">View payments &amp; settlements</div>
              </div>
            </div>
            <ChevronRight size={15} className="text-slate-300 group-hover:text-amber-600 transition-colors" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("emails")}
            className="bg-white hover:bg-blue-50/50 border border-slate-200/90 hover:border-blue-200 rounded-2xl p-3.5 text-left shadow-2xs transition-all cursor-pointer group flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Mail size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Email &amp; TPA Hub</div>
                <div className="text-[11px] text-slate-400">Track TPA communications</div>
              </div>
            </div>
            <ChevronRight size={15} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
          </button>
        </div>

        {/* ── 4. MAIN LAYOUT: FULL WIDTH TABLE + BOTTOM WIDGETS ── */}
        <div className="space-y-6">
          {/* TOP SECTION: FILTERS + ACTIVE CASES TABLE */}
          <div className="space-y-4 min-w-0">

            {/* Filter Control Bar */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[240px]">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search patient, UHID, claim or policy number…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all"
                  />
                </div>

                {/* Insurer Filter */}
                <select
                  value={selectedInsurer}
                  onChange={(e) => setSelectedInsurer(e.target.value)}
                  className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-700 font-semibold focus:outline-none focus:bg-white cursor-pointer"
                >
                  <option value="">All Insurers</option>
                  <option value="Care Health">Care Health Insurance</option>
                  <option value="Star Health">Star Health &amp; Allied</option>
                  <option value="ICICI Lombard">ICICI Lombard</option>
                  <option value="HDFC ERGO">HDFC ERGO</option>
                </select>

                {/* Ward Filter */}
                <select
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-700 font-semibold focus:outline-none focus:bg-white cursor-pointer"
                >
                  <option value="">All Wards</option>
                  <option value="ICU">ICU</option>
                  <option value="ER">ER</option>
                  <option value="IP">IP</option>
                  <option value="OT">OT</option>
                </select>

                {/* Claim Stages Filter */}
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-700 font-semibold focus:outline-none focus:bg-white cursor-pointer"
                >
                  <option value="">All Claim Stages</option>
                  <option value="Pre-Auth">Pre-Authorization</option>
                  <option value="Discharge & Final Bill">Discharge &amp; Final Bill</option>
                  <option value="Claim Adjudication">Claim Adjudication</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="h-9 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Active Cashless Cases Table */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 min-w-[200px]">Patient &amp; UHID</th>
                      <th className="py-3 px-4 min-w-[200px]">Insurer / TPA</th>
                      <th className="py-3 px-4 min-w-[150px]">Admission Details</th>
                      <th className="py-3 px-4 min-w-[140px]">Claim Stage</th>
                      <th className="py-3 px-4 min-w-[120px]">Status</th>
                      <th className="py-3 px-4 min-w-[120px]">Claim Amount</th>
                      <th className="py-3 px-4 min-w-[180px]">Next Action</th>
                      <th className="py-3 px-4 min-w-[100px]">Updated</th>
                      <th className="py-3 px-3 w-8 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500">
                          <p className="font-semibold text-[13px] mb-2">No active claims found</p>
                          <p className="text-[11.5px] max-w-sm mx-auto">
                            Create a new case using "New Pre-Auth" or register a new patient via Intake.
                          </p>
                        </td>
                      </tr>
                    ) : tableRows.map((r, i) => {
                      const insBadge = INSURER_BADGES[r.insurerName] || {
                        bg: "bg-blue-700",
                        text: "text-white font-black",
                        label: r.insurerName.slice(0, 4).toUpperCase(),
                      }

                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                          onClick={() => onNavigate("claims", r.id)}
                        >
                          {/* Patient & UHID */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full ${r.avatarBg} font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs`}>
                                {r.patientName.split(" ").map((n) => n[0]).join("")}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors whitespace-nowrap">
                                  {r.patientName}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                  <span className="font-mono text-[10px] text-slate-400">{r.id}</span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold border ${r.wardColor}`}>
                                    {r.ward}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Insurer / TPA */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider shrink-0 ${insBadge.bg} ${insBadge.text}`}>
                                {insBadge.label}
                              </span>
                              <span className="font-semibold text-slate-800 text-xs min-w-[120px] whitespace-normal">
                                {r.insurerName}
                              </span>
                            </div>
                          </td>

                          {/* Admission Details */}
                          <td className="py-3 px-4">
                            <div className="text-slate-800 font-semibold">{r.admissionDetails}</div>
                            <div className="text-slate-400 text-[11px] mt-0.5">{r.doctor}</div>
                          </td>

                          {/* Claim Stage Bar */}
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 mb-1">
                              <span>{r.stage}</span>
                              <span className="text-slate-400 font-mono">{r.step}</span>
                            </div>
                            <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.progressPct}%` }} />
                            </div>
                          </td>

                          {/* Status Pill */}
                          <td className="py-3 px-4">
                            <StatusPill status={r.rawStatus} />
                          </td>

                          {/* Claim Amount */}
                          <td className="py-3 px-4 font-mono font-extrabold text-slate-900 text-xs">
                            ₹{r.amount.toLocaleString("en-IN")}
                          </td>

                          {/* Next Action */}
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                notify(`Executing action: ${r.nextAction}`, "success")
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold rounded-xl border border-purple-200 transition-colors cursor-pointer"
                            >
                              <Upload size={12} />
                              <span className="truncate max-w-[160px]">{r.nextAction}</span>
                            </button>
                          </td>

                          {/* Updated */}
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {r.updated}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => notify(`Options menu for ${r.id}`, "success")}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <MoreVertical size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {tableRows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center">
                            <Shield size={32} className="text-slate-300 stroke-[1.5] mb-2" />
                            <span className="text-xs font-semibold text-slate-600">No insurance cases found</span>
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              {storeCases.length === 0 ? "No active insurance claims in the hospital" : "Try resetting your search or filter options"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="p-3.5 border-t border-slate-200/80 bg-slate-50/60 flex items-center justify-between text-xs text-slate-500 font-medium">
                <div>Showing {tableRows.length > 0 ? `1–${tableRows.length}` : 0} of {tableRows.length} cases</div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button type="button" className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer">
                      <ChevronLeft size={14} />
                    </button>
                    <button type="button" className="w-6 h-6 rounded bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                      1
                    </button>
                    <button type="button" className="p-1 rounded bg-white border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer">
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  <span className="text-slate-400 font-mono text-[11px]">10 / page</span>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM WIDGETS: 3 COLUMNS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Widget 1: My Tasks */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-amber-500 fill-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900">My Tasks</h3>
                </div>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {dashboardStats.taskList.length} pending
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                {dashboardStats.taskList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No pending tasks — all cashless workflows up to date
                  </div>
                ) : (
                  dashboardStats.taskList.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onNavigate("case", task.id)}
                      className="p-3 bg-slate-50 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-200 rounded-xl transition-all cursor-pointer space-y-1 group"
                    >
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${task.tone === "rose" ? "bg-rose-500" : task.tone === "blue" ? "bg-blue-500" : "bg-amber-500"}`} />
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {task.title}
                          </div>
                          <div className="text-[11.5px] text-slate-400">
                            {task.desc}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10.5px] text-slate-500 font-semibold pl-4 pt-0.5">
                        <Clock size={11} />
                        <span>{task.due}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Widget 2: Outstanding by Insurer */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Outstanding by Insurer</h3>
                <button
                  type="button"
                  onClick={() => onNavigate("masters")}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {dashboardStats.insurerList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No active insurer claims
                  </div>
                ) : (
                  dashboardStats.insurerList.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 hover:bg-slate-100/70 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-lg ${item.bg} text-[9px] font-black flex items-center justify-center shrink-0`}>
                          {item.tag}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 truncate">{item.name}</div>
                          <div className="text-[10.5px] text-slate-400">{item.cases}</div>
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-slate-900 text-xs">
                        {item.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Widget 3: Claim Stage Distribution (Donut Chart) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3 flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">Claim Stage Distribution</h3>
                <button
                  type="button"
                  onClick={() => notify("Viewing interactive stage distribution chart...", "success")}
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  View chart
                </button>
              </div>

              <div className="flex items-center justify-center py-2 relative">
                {/* SVG Donut Chart */}
                <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="text-slate-100"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {dashboardStats.totalCases > 0 && (
                    <>
                      {/* Segment 1: Pre-Auth Pending */}
                      <path
                        className="text-amber-500"
                        strokeDasharray={`${dashboardStats.pctPreauth}, 100`}
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {/* Segment 2: Claim Adjudication */}
                      <path
                        className="text-cyan-500"
                        strokeDasharray={`${dashboardStats.pctClaim}, 100`}
                        strokeDashoffset={`-${dashboardStats.pctPreauth}`}
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {/* Segment 3: Discharge & Final Bill */}
                      <path
                        className="text-teal-500"
                        strokeDasharray={`${dashboardStats.pctDischarge}, 100`}
                        strokeDashoffset={`-${dashboardStats.pctPreauth + dashboardStats.pctClaim}`}
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      {/* Segment 4: Other / Enhancements */}
                      <path
                        className="text-purple-500"
                        strokeDasharray={`${dashboardStats.pctOther}, 100`}
                        strokeDashoffset={`-${dashboardStats.pctPreauth + dashboardStats.pctClaim + dashboardStats.pctDischarge}`}
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </>
                  )}
                </svg>

                {/* Donut Center Label */}
                <div className="absolute text-center">
                  <div className="text-xl font-extrabold text-slate-900">{dashboardStats.totalCases}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Cases</div>
                </div>
              </div>

              {/* Chart Legend */}
              <div className="space-y-1.5 text-xs pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="font-semibold text-slate-700">Pre-Auth Pending</span>
                  </div>
                  <span className="font-mono text-slate-500 font-bold">
                    {dashboardStats.stagePreauth} ({dashboardStats.pctPreauth}%)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    <span className="font-semibold text-slate-700">Claim Adjudication</span>
                  </div>
                  <span className="font-mono text-slate-500 font-bold">
                    {dashboardStats.stageClaim} ({dashboardStats.pctClaim}%)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    <span className="font-semibold text-slate-700">Discharge &amp; Final Bill</span>
                  </div>
                  <span className="font-mono text-slate-500 font-bold">
                    {dashboardStats.stageDischarge} ({dashboardStats.pctDischarge}%)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="font-semibold text-slate-700">Other / Enhancements</span>
                  </div>
                  <span className="font-mono text-slate-500 font-bold">
                    {dashboardStats.stageOther} ({dashboardStats.pctOther}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
