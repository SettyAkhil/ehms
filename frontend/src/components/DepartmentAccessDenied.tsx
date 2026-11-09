import React, { useState } from "react"
import { ShieldAlert, ArrowLeft, Lock, CheckCircle2, UserCheck, Settings } from "lucide-react"

interface DepartmentAccessDeniedProps {
  moduleKey: string
  activeStaff?: {
    id: string
    name: string
    role?: string
    title?: string
    department?: string
  }
  userRole?: string
  userPermissions?: string[]
  onNavigateHome: () => void
  onOpenAdmin?: () => void
  onNavigateToModule?: (mod: string) => void
}

const DEPT_INFO: Record<string, { name: string; icon: string; description: string }> = {
  patients: { name: "Patient Registration & Reception", icon: "👤", description: "Patient intake, search, demography, and MRN master records" },
  outpatient: { name: "Outpatient Department (OPD)", icon: "🩺", description: "Doctor consultations, appointment queues, and vitals recording" },
  op_management: { name: "Outpatient Department (OPD)", icon: "🩺", description: "Doctor consultations, appointment queues, and vitals recording" },
  clinical: { name: "Clinical & Doctor Workspace", icon: "📋", description: "Clinical encounters, electronic prescriptions, and diagnostic charting" },
  chart: { name: "Clinical Encounters", icon: "📋", description: "Clinical notes, electronic prescriptions, and diagnosis records" },
  emergency: { name: "Emergency Department (ER)", icon: "🚨", description: "Emergency triage, resuscitation bays, trauma care, and rapid intake" },
  inpatient: { name: "Inpatient Department (IPD)", icon: "🛏️", description: "Ward occupancy, bed transfers, admission and discharge management" },
  beds: { name: "Bed Management", icon: "🛏️", description: "Ward occupancy, bed transfers, admission and discharge management" },
  icu: { name: "Intensive Care Unit (ICU)", icon: "💓", description: "Critical care telemetry, ventilator tracking, and vital beds" },
  laboratory: { name: "Laboratory Diagnostics", icon: "🧪", description: "Specimen collection, hematology/biochemistry tests, and lab result sign-offs" },
  radiology: { name: "Radiology & Imaging", icon: "🩻", description: "X-Ray, CT, MRI, Ultrasound imaging worklists and radiologist reports" },
  pharmacy: { name: "Pharmacy & Dispensary", icon: "💊", description: "Medication inventory, prescription dispensing, returns, and stock batches" },
  surgery: { name: "Operation Theatre & Surgery", icon: "🔪", description: "Operation theatre bookings, surgical notes, and anesthesia records" },
  billing: { name: "Billing & Cash Counter", icon: "💳", description: "OP/IP/ER invoices, cash desk receipts, lab payments, and refunds" },
  insurance: { name: "Insurance & TPA", icon: "🛡️", description: "Cashless pre-auth requests, claim document packs, query responses, settlements" },
  accounts: { name: "Finance & Accounts", icon: "📊", description: "General ledger, journal vouchers, accounts payable/receivable, and P&L" },
  hrms: { name: "Human Resources (HRMS)", icon: "👥", description: "Staff attendance, duty rosters, payroll, leaves, and credentialing" },
  my_hr: { name: "My HR Portal", icon: "👤", description: "Employee self-service, leave requests, shift schedule, and pay slips" },
  intelligence: { name: "Hosp AI Clinical Intelligence", icon: "🤖", description: "Diagnostic triage suggestions, symptom assistance, and clinical NLP" },
  reports: { name: "Hospital Analytics & Reports", icon: "📈", description: "Executive statistics, census reports, financial summaries, and KPIs" },
  admin: { name: "Administration & RBAC", icon: "⚙️", description: "Centralized role-based access control, user provisioning, and hospital setup" },
  dashboard: { name: "Hospital Executive Dashboard", icon: "📊", description: "Hospital-wide operational KPIs and real-time census" },
}

export default function DepartmentAccessDenied({
  moduleKey,
  activeStaff,
  userRole = "Hospital Staff",
  userPermissions = [],
  onNavigateHome,
  onOpenAdmin,
  onNavigateToModule,
}: DepartmentAccessDeniedProps) {
  const [requestSent, setRequestSent] = useState(false)
  const dept = DEPT_INFO[moduleKey] || {
    name: moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1).replace(/_/g, " "),
    icon: "🏥",
    description: "Hospital department operations and patient care records",
  }

  // Find granted departments the user CAN access
  const accessibleDepts = Object.keys(DEPT_INFO).filter((k) =>
    userPermissions.includes(k) || userPermissions.some((p) => p.startsWith(k + ":") || p.startsWith(k + "."))
  )

  const handleRequestAccess = () => {
    setRequestSent(true)
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-[#F8FAFC] min-h-[calc(100vh-4rem)]">
      <div className="w-full max-w-xl bg-white border border-[#CBD5E1] shadow-xl p-8 rounded-none text-left space-y-6">
        {/* Header alert badge */}
        <div className="flex items-start justify-between border-b border-[#E2E8F0] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-2xl shrink-0">
              {dept.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#0F172A]">{dept.name}</h1>
                <span className="bg-amber-100 text-amber-800 text-[10.5px] font-bold px-2 py-0.5 border border-amber-300 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Restricted
                </span>
              </div>
              <p className="text-[12.5px] text-[#64748B] mt-0.5">{dept.description}</p>
            </div>
          </div>
        </div>

        {/* Security / Notice Details */}
        <div className="bg-[#FEF3C7]/40 border-l-4 border-amber-500 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-[13px]">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Authorization Required for this Department</span>
          </div>
          <p className="text-[12px] text-[#475569] leading-relaxed">
            Your staff account is currently active, but your assigned role or individual user permissions do not include access to the <strong>{dept.name}</strong> module.
          </p>
        </div>

        {/* Current Identity & Role Details */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 text-[12px] grid grid-cols-2 gap-3">
          <div>
            <span className="text-[#64748B] block text-[11px] font-semibold uppercase tracking-wider">Signed In As</span>
            <span className="font-bold text-[#0F172A]">{activeStaff?.name || "Staff User"}</span>
            <span className="text-[#64748B] block font-mono text-[11px]">ID: {activeStaff?.id || "N/A"}</span>
          </div>
          <div>
            <span className="text-[#64748B] block text-[11px] font-semibold uppercase tracking-wider">Assigned Role</span>
            <span className="font-bold text-[#1B4FD8]">{userRole}</span>
            <span className="text-[#64748B] block text-[11px]">{activeStaff?.department || "Clinical Staff"}</span>
          </div>
        </div>

        {/* Departments this user CAN access */}
        {accessibleDepts.length > 0 && (
          <div>
            <div className="text-[11.5px] font-bold text-[#475569] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Your Authorized Workspaces:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {accessibleDepts.map((k) => {
                const info = DEPT_INFO[k]
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onNavigateToModule ? onNavigateToModule(k) : onNavigateHome()}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1B4FD8] border border-blue-200 text-[12px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{info?.icon || "📁"}</span>
                    <span>{info?.name || k}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Request Access Feedback */}
        {requestSent && (
          <div className="bg-emerald-50 border border-emerald-200 p-3 text-[12.5px] text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Access request for <strong>{dept.name}</strong> has been logged and sent to your Hospital Administrator.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={onNavigateHome}
            className="bg-[#1B4FD8] hover:bg-[#1740B4] text-white text-[13px] font-semibold px-4 py-2 flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to My Workspace</span>
          </button>

          <div className="flex items-center gap-2">
            {!requestSent && (
              <button
                type="button"
                onClick={handleRequestAccess}
                className="bg-white hover:bg-slate-50 text-[#334155] border border-[#CBD5E1] text-[12.5px] font-semibold px-3.5 py-2 transition-colors cursor-pointer"
              >
                Request Department Access
              </button>
            )}

            {onOpenAdmin && (userRole === "ROLE_ADMIN" || userRole === "admin" || activeStaff?.id === "ADM-001") && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="bg-[#0F172A] hover:bg-[#1E293B] text-white text-[12.5px] font-semibold px-3.5 py-2 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configure in Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
