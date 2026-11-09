import React, { useState, useEffect } from "react"
import { SurgeryDatabase, UrgencyLevel } from "../../services/surgeryDb"
import { BedDatabase, BedRecord } from "../../services/bedDb"
import { apiFetch } from "../../lib/api"
import { Btn } from "../shared"
import { toast } from "react-hot-toast"

export interface InitialSurgeryPatient {
  patientId?: string
  patientName?: string
  mrn?: string
  ipNo?: string
  age?: number | string
  gender?: "Male" | "Female" | "Other"
  source?: "OPD Consultation" | "Inpatient Ward" | "Emergency Department"
  ward?: string
  bedNo?: string
  diagnosis?: string
  procedure?: string
  urgency?: UrgencyLevel
}

interface ScheduleSurgeryModalProps {
  initialOrRoom?: string | null
  initialPatient?: InitialSurgeryPatient | null
  onClose: () => void
  onSuccess: () => void
}

export default function ScheduleSurgeryModal({
  initialOrRoom,
  initialPatient,
  onClose,
  onSuccess,
}: ScheduleSurgeryModalProps) {
  const [patientName, setPatientName] = useState(initialPatient?.patientName || "")
  const [mrn, setMrn] = useState(
    initialPatient?.mrn || initialPatient?.patientId || `UMR${Math.floor(100100 + Math.random() * 899000)}`,
  )
  const [ipNo, setIpNo] = useState(
    initialPatient?.ipNo || `IP-${Math.floor(884900 + Math.random() * 900)}`,
  )
  const [age, setAge] = useState(initialPatient?.age ? String(initialPatient.age) : "45")
  const [gender, setGender] = useState<"Male" | "Female" | "Other">(initialPatient?.gender || "Male")
  const [source, setSource] = useState<"OPD Consultation" | "Inpatient Ward" | "Emergency Department">(
    initialPatient?.source || (initialPatient?.ward ? "Inpatient Ward" : "OPD Consultation"),
  )
  const [currentWard, setCurrentWard] = useState(initialPatient?.ward || "")
  const [currentBedNo, setCurrentBedNo] = useState(initialPatient?.bedNo || "")

  const [procedure, setProcedure] = useState(
    initialPatient?.procedure || (initialPatient?.diagnosis ? `Surgical intervention for ${initialPatient.diagnosis}` : ""),
  )
  const [specialty, setSpecialty] = useState("General Surgery")
  const [cptCode, setCptCode] = useState("47562")
  const [icd10Code, setIcd10Code] = useState("K80.20")
  const [surgeon, setSurgeon] = useState("Dr. Adams")
  const [assistantSurgeon, setAssistantSurgeon] = useState("Dr. Williams")
  const [anesthesiologist, setAnesthesiologist] = useState("Dr. Rodriguez")
  const [orRoom, setOrRoom] = useState(initialOrRoom || "OR 1")
  const [scheduledTime, setScheduledTime] = useState("09:00 AM")
  const [durationEst, setDurationEst] = useState("120 mins")
  const [urgency, setUrgency] = useState<UrgencyLevel>(initialPatient?.urgency || "Elective")
  const [insuranceProvider, setInsuranceProvider] = useState("Star Health")
  const [totalAmount, setTotalAmount] = useState(48000)
  const [submitting, setSubmitting] = useState(false)

  // Active admitted patients from Ward & ICU beds
  const [admittedPatients, setAdmittedPatients] = useState<Array<{
    patientId: string
    patientName: string
    mrn: string
    ipNo: string
    age: string
    gender: "Male" | "Female" | "Other"
    ward: string
    bedNo: string
    notes?: string
    isIcu: boolean
  }>>([])

  useEffect(() => {
    let active = true
    apiFetch<{ beds: BedRecord[] }>("/api/beds")
      .then((data) => {
        if (!active) return
        const occupied = (data.beds || []).filter(
          (b) => b.status === "Occupied" && (b.patient_id || b.patient_name),
        )
        const mapped = occupied.map((b) => ({
          patientId: b.patient_id || `UMR-${b.id}`,
          patientName: `${b.patient_name || ""} ${b.patient_last_name || ""}`.trim() || "Admitted Patient",
          mrn: b.patient_id || `UMR-${b.id}`,
          ipNo: `IP-${b.admission_id || b.allocation_id || b.id}`,
          age: b.patient_age ? String(b.patient_age) : "45",
          gender: (b.patient_gender === "Female" ? "Female" : "Male") as "Male" | "Female" | "Other",
          ward: b.ward || "Inpatient Ward",
          bedNo: b.bed_no || String(b.id),
          notes: b.admission_notes || undefined,
          isIcu: b.bed_type === "ICU" || (b.ward || "").toLowerCase().includes("icu"),
        }))
        setAdmittedPatients(mapped)
      })
      .catch(() => {
        if (!active) return
        const localBeds = BedDatabase.getBeds().filter(
          (b) => b.status === "Occupied" && (b.patient_id || b.patient_name),
        )
        const mapped = localBeds.map((b) => ({
          patientId: b.patient_id || `UMR-${b.id}`,
          patientName: `${b.patient_name || ""} ${b.patient_last_name || ""}`.trim() || "Admitted Patient",
          mrn: b.patient_id || `UMR-${b.id}`,
          ipNo: `IP-${b.admission_id || b.allocation_id || b.id}`,
          age: b.patient_age ? String(b.patient_age) : "45",
          gender: (b.patient_gender === "Female" ? "Female" : "Male") as "Male" | "Female" | "Other",
          ward: b.ward || "Inpatient Ward",
          bedNo: b.bed_no || String(b.id),
          notes: b.admission_notes || undefined,
          isIcu: b.bed_type === "ICU" || (b.ward || "").toLowerCase().includes("icu"),
        }))
        setAdmittedPatients(mapped)
      })
    return () => {
      active = false
    }
  }, [])

  const handlePickAdmitted = (val: string) => {
    const picked = admittedPatients.find((p) => p.mrn === val || p.patientId === val)
    if (!picked) return
    setPatientName(picked.patientName)
    setMrn(picked.mrn)
    setIpNo(picked.ipNo)
    setAge(picked.age)
    setGender(picked.gender)
    setSource("Inpatient Ward")
    setCurrentWard(picked.ward)
    setCurrentBedNo(picked.bedNo)
    if (picked.isIcu) {
      setUrgency("Urgent")
    }
    if (picked.notes && !procedure) {
      setProcedure(`Surgical intervention for ${picked.notes}`)
    }
    toast.success(`Selected admitted patient: ${picked.patientName} (${picked.ward}, Bed ${picked.bedNo})`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patientName.trim() || !procedure.trim()) {
      toast.error("Please enter patient name and surgical procedure.")
      return
    }

    setSubmitting(true)
    try {
      await SurgeryDatabase.createCase({
        patientId: mrn,
        patientName,
        mrn,
        ipNo,
        age: parseInt(age) || 45,
        gender,
        procedureName: procedure,
        specialty,
        cptCode,
        icd10Code,
        surgeon,
        assistantSurgeon,
        anesthesiologist,
        scrubNurse: "RN Murphy",
        circulatingNurse: "RN Davis",
        orRoom,
        scheduledTime,
        durationEst,
        urgency,
        insuranceProvider,
        totalAmount,
        status: urgency === "Emergency STAT" ? "Pre-Op Holding" : "PAC Pending",
      })

      const locationText = currentWard ? ` (Origin: ${currentWard} - Bed ${currentBedNo})` : ""
      toast.success(`Surgery case scheduled successfully for ${patientName} in ${orRoom}${locationText}!`)
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err?.message || "Failed to schedule surgery case.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-[#DDE2EC] flex flex-col max-h-[92vh] text-xs">
        {/* Header */}
        <div className="bg-[#1E3A6E] text-white px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📅</span>
            <div>
              <h3 className="font-bold text-sm tracking-wide">
                Schedule Surgical Case &amp; OT Booking
              </h3>
              <p className="text-[11px] text-slate-300">
                Operating Theatre Reservation · Pre-Anesthetic Workup &amp; 14-Page OT Booklet Intake
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Quick Pick Banner for Admitted Patients */}
          {admittedPatients.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-white border border-blue-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">🏥</span>
                <div>
                  <span className="text-[11.5px] font-bold text-blue-950 block">
                    Book Admitted Inpatient / Critical Care Patient
                  </span>
                  <span className="text-[10.5px] text-blue-800">
                    Select an active Ward or ICU patient to auto-populate all demographics &amp; bed location
                  </span>
                </div>
              </div>
              <select
                aria-label="Pick admitted patient"
                onChange={(e) => handlePickAdmitted(e.target.value)}
                value={admittedPatients.some((p) => p.mrn === mrn) ? mrn : ""}
                className="border border-blue-300 rounded-lg px-2.5 py-1.5 text-xs bg-white text-blue-950 font-medium shrink-0 max-w-[280px] shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Quick Pick: Select Ward/ICU Patient...</option>
                {admittedPatients.map((p) => (
                  <option key={`${p.patientId}-${p.bedNo}`} value={p.mrn}>
                    {p.patientName} ({p.ward} · Bed {p.bedNo})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Current Location Badge if from Ward/ICU */}
          {currentWard && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center justify-between text-[11px] text-emerald-800 font-medium">
              <div className="flex items-center gap-1.5">
                <span>🛏️</span>
                <span>
                  Current Inpatient Bed: <strong>{currentWard}</strong> (Room/Bed: <strong>{currentBedNo}</strong>)
                </span>
              </div>
              <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold">
                Linked Inpatient Admission
              </span>
            </div>
          )}

          {/* Patient Demographics */}
          <div className="bg-[#F8FAFC] border border-[#DDE2EC] rounded-xl p-3.5 space-y-3">
            <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>Patient Demographics &amp; Origin</span>
              <span className="text-[10.5px] font-normal text-slate-500">
                Origin: {source}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Patient Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meera Subramanian"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-2 text-xs bg-white focus:outline-none focus:border-slate-800"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Patient Source
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as any)}
                  className="w-full border border-[#DDE2EC] rounded p-2 text-xs bg-white"
                >
                  <option value="Inpatient Ward">Inpatient Ward</option>
                  <option value="OPD Consultation">OPD Consultation</option>
                  <option value="Emergency Department">Emergency (ER / Trauma)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">MRN / UMR</label>
                <input
                  type="text"
                  value={mrn}
                  onChange={(e) => setMrn(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">IP Number</label>
                <input
                  type="text"
                  value={ipNo}
                  onChange={(e) => setIpNo(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Procedure & Clinical Specialty */}
          <div className="bg-[#F8FAFC] border border-[#DDE2EC] rounded-xl p-3.5 space-y-3">
            <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>Surgical Procedure &amp; Clinical Codes</span>
              <span className="text-[10.5px] font-mono text-slate-500">CPT / ICD-10 Compliant</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Procedure Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Laparoscopic Cholecystectomy / Emergency Craniotomy"
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-2 text-xs bg-white focus:outline-none focus:border-slate-800"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Specialty</label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-2 text-xs bg-white"
                >
                  <option value="General Surgery">General Surgery</option>
                  <option value="Orthopedic Surgery">Orthopedic Surgery</option>
                  <option value="Neurosurgery">Neurosurgery</option>
                  <option value="Cardiothoracic Surgery">Cardiothoracic Surgery</option>
                  <option value="Surgical Oncology">Surgical Oncology</option>
                  <option value="Urology">Urology</option>
                  <option value="Gynecology & Obstetrics">Gynecology &amp; Obstetrics</option>
                  <option value="ENT Surgery">ENT Surgery</option>
                  <option value="Plastic & Reconstructive">Plastic &amp; Reconstructive</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">CPT Code</label>
                <input
                  type="text"
                  value={cptCode}
                  onChange={(e) => setCptCode(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">ICD-10 Code</label>
                <input
                  type="text"
                  value={icd10Code}
                  onChange={(e) => setIcd10Code(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Surgical Team Assignment */}
          <div className="bg-[#F8FAFC] border border-[#DDE2EC] rounded-xl p-3.5 space-y-3">
            <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>Surgical &amp; Anesthesia Team</span>
              <span className="text-[10.5px] text-slate-500">Credited Consultants</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Primary Surgeon</label>
                <select
                  value={surgeon}
                  onChange={(e) => setSurgeon(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white font-semibold"
                >
                  <option value="Dr. Adams">Dr. Adams (General &amp; Laparoscopic)</option>
                  <option value="Dr. Sterling">Dr. Sterling (Orthopedic Joint &amp; Trauma)</option>
                  <option value="Dr. Chen">Dr. Chen (Neuro &amp; Spine Surgery)</option>
                  <option value="Dr. Thorne">Dr. Thorne (Cardiothoracic Surgery)</option>
                  <option value="Dr. Gupta">Dr. Gupta (Surgical Oncology)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Assistant Surgeon</label>
                <input
                  type="text"
                  value={assistantSurgeon}
                  onChange={(e) => setAssistantSurgeon(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Chief Anesthesiologist</label>
                <select
                  value={anesthesiologist}
                  onChange={(e) => setAnesthesiologist(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white font-semibold"
                >
                  <option value="Dr. Rodriguez">Dr. Rodriguez (Consultant Anesthesiology)</option>
                  <option value="Dr. Vance">Dr. Vance (Cardiac &amp; Neuro Anesthesia)</option>
                  <option value="Dr. Mehta">Dr. Mehta (Pediatric &amp; Regional Anesthesia)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Theatre Logistics & Scheduling */}
          <div className="bg-[#F8FAFC] border border-[#DDE2EC] rounded-xl p-3.5 space-y-3">
            <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center justify-between">
              <span>Theatre Booking Logistics</span>
              <span className="text-[10.5px] text-slate-500">OR Allocation</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Assigned OR Suite</label>
                <select
                  value={orRoom}
                  onChange={(e) => setOrRoom(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white font-bold"
                >
                  <option value="OR 1">OR 1 - General Laparoscopy</option>
                  <option value="OR 2">OR 2 - Ortho &amp; Laminar Airflow</option>
                  <option value="OR 3">OR 3 - Neuro &amp; Spine Suite</option>
                  <option value="OR 4">OR 4 - Cardiac &amp; Vascular</option>
                  <option value="OR 5">OR 5 - Emergency STAT Suite</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Scheduled Time</label>
                <input
                  type="text"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Estimated Duration</label>
                <input
                  type="text"
                  value={durationEst}
                  onChange={(e) => setDurationEst(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-1.5 text-xs bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Clinical Urgency</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as any)}
                  className={`w-full border rounded p-1.5 text-xs font-bold ${
                    urgency === "Emergency STAT"
                      ? "bg-rose-50 border-rose-300 text-rose-700"
                      : urgency === "Urgent"
                        ? "bg-amber-50 border-amber-300 text-amber-800"
                        : "bg-white border-[#DDE2EC] text-slate-800"
                  }`}
                >
                  <option value="Elective">Elective (Planned Routine)</option>
                  <option value="Urgent">Urgent (&lt; 6 Hours)</option>
                  <option value="Emergency STAT">🚨 Emergency STAT (&lt; 30 Mins)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Insurance / Payer</label>
                <input
                  type="text"
                  value={insuranceProvider}
                  onChange={(e) => setInsuranceProvider(e.target.value)}
                  className="w-full border border-[#DDE2EC] rounded p-2 text-xs bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Estimated Surgical Package Amount (₹)
                </label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                  className="w-full border border-[#DDE2EC] rounded p-2 text-xs bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-[#DDE2EC] flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-mono">
              Auto-initiates Stage 1: Pre-Op PAC Assessment &amp; 14-Page OT Booklet
            </span>
            <div className="flex gap-2">
              <Btn type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" size="sm" disabled={submitting}>
                {submitting ? "Booking Case..." : "Confirm & Schedule Surgery ➔"}
              </Btn>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
