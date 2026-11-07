import React, { useState, useMemo, useEffect } from "react"
import { apiFetch } from "../lib/api"
import { ALL_SYSTEM_MODULES } from "../services/roleDb"
import { HrmsDatabase } from "../services/hrmsDb"
import {
  DOCTOR_ROSTER,
  getAllDoctorAccounts,
  normalizeDoctorName,
  resolveDoctorAccount,
} from "../services/doctorPortalDb"
import { HospAILogo } from "./HospAILogo"
import { KalpraLogo } from "./KalpraLogo"

interface StaffOption {
  id: string
  name: string
  subtitle: string
  department: string
}

interface LoginRoleOption {
  value: string
  label: string
  sub: string
}

interface RoleLoginUser {
  id: string
  full_name: string
  employee_id: string
  department?: string
}

interface LoginSummary {
  active_roles: number
  active_staff: number
  available_modules: number
  security: string
}

export interface LoginUserData {
  user: string
  role: string
  staffId: string
  staffName?: string
  staffTitle?: string
  staffDepartment?: string
  permissions: string[]
  /** Which physician signed in -- each doctor gets their own portal. */
  doctorId?: string
}

export interface AuthenticatedUser {
  username: string
  role?: string
  role_key?: string
  access_role?: string
  job_role?: string
  user_type?: string
  module_access?: string[]
  permissions?: string[]
  full_name?: string
  employee_id?: string
  department?: string
}

interface LoginProps {
  onLogin: (userData: LoginUserData) => void
}

const ROLES_LIST: LoginRoleOption[] = [
  { value: "admin", label: "System Admin", sub: "IT Administration & Security" },
]

// Backend grants are domain-oriented; the shell has a few presentation keys
// with different names. Expand only those aliases for navigation visibility.
// This does not grant API permissions: every protected request is still
// authorized by the server-side permission attached to the session.
const NAVIGATION_MODULE_ALIASES: Record<string, string[]> = {
  patients: ["patients", "register", "appointments", "patient_messages", "clinical", "chart"],
  op: ["outpatient", "op_management", "queue", "op_nurse", "opd_procedures"],
  er: ["emergency", "emergency_ui", "triage"],
  beds: ["inpatient", "beds", "admissions", "readmission", "discharge"],
  symptom_ai: ["intelligence", "symptom_ai", "clinical_rag", "clinical_summaries", "bulk_ai", "nl_filtering"],
  billing: ["billing", "billing_op", "billing_ip", "billing_er", "lab_billing", "billing_unified", "payments", "billing_revenue"],
  accounts: ["accounts", "accounts_dashboard", "accounts_coa", "accounts_gl", "accounts_receipts", "accounts_payments", "accounts_ar", "accounts_ap", "accounts_cash_bank", "accounts_pharmacy", "accounts_insurance", "accounts_tax", "accounts_budget", "accounts_assets", "accounts_reports", "accounts_period_close", "accounts_audit", "accounts_manager"],
  patient_experience: ["patient_exp", "patient_messages"],
}

function navigationModules(moduleAccess: string[]): string[] {
  const modules = new Set<string>()
  for (const module of moduleAccess) {
    if (!module) continue
    modules.add(module)
    // Extract base module name from granular permissions like "pharmacy:view" or "pharmacy.rx"
    const base = module.split(/[:.]/)[0]
    if (base) {
      modules.add(base)
    }
    for (const alias of NAVIGATION_MODULE_ALIASES[module] || []) {
      modules.add(alias)
    }
    if (base && base !== module) {
      for (const alias of NAVIGATION_MODULE_ALIASES[base] || []) {
        modules.add(alias)
      }
    }
  }
  return [...modules]
}

/** Convert the backend's authenticated profile into the app's display model.
 * This deliberately uses no browser-stored role or permissions. */
export function loginUserFromAuthenticated(
  authenticated: AuthenticatedUser,
): LoginUserData {
  const accessRole = (authenticated.access_role || "").toLowerCase()
  const assignedRole = (authenticated.role_key || authenticated.role || "").trim().toUpperCase()
  const roleByAccess: Record<string, string> = {
    clinician: "ROLE_DOCTOR",
    doctor: "ROLE_DOCTOR",
    nurse: "ROLE_NURSE",
    pharmacist: "ROLE_PHARMACIST",
    pharmacy: "ROLE_PHARMACIST",
    lab: "ROLE_LAB_TECHNICIAN",
    lab_technician: "ROLE_LAB_TECHNICIAN",
    laboratory: "ROLE_LAB_TECHNICIAN",
    receptionist: "ROLE_RECEPTIONIST",
    reception: "ROLE_RECEPTIONIST",
    billing: "ROLE_BILLING_EXECUTIVE",
    insurance: "ROLE_INSURANCE_TPA_OFFICER",
    finance: "ROLE_ACCOUNTANT",
    accountant: "ROLE_ACCOUNTANT",
    hr: "ROLE_HR_MANAGER",
    radiologist: "ROLE_RADIOLOGIST",
    radiology: "ROLE_RADIOLOGIST",
  }
  const isSystemAdmin =
    authenticated.username?.toLowerCase() === "admin" ||
    authenticated.username?.toLowerCase() === "administrator" ||
    authenticated.username?.toLowerCase().includes("admin") ||
    authenticated.user_type === "admin" ||
    accessRole === "owner" ||
    assignedRole === "ROLE_ADMIN" ||
    assignedRole === "ROLE_SUPERADMIN" ||
    assignedRole === "ADMIN" ||
    authenticated.employee_id === "ADM-001"

  const role = isSystemAdmin
    ? "ROLE_ADMIN"
    : assignedRole ||
      (authenticated.user_type === "admin" ? "ROLE_ADMIN" : undefined) ||
      roleByAccess[accessRole] ||
      `ROLE_${(accessRole || "STAFF").toUpperCase()}`

  return {
    user: authenticated.username,
    role,
    staffId: isSystemAdmin ? "ADM-001" : (authenticated.employee_id || authenticated.username),
    staffName: isSystemAdmin ? (authenticated.full_name || "System Administrator") : (authenticated.full_name || authenticated.username),
    staffTitle: isSystemAdmin ? "System Administrator" : (authenticated.job_role || accessRole || "Hospital Staff"),
    staffDepartment: isSystemAdmin ? "Administration" : (authenticated.department || "Hospital Operations"),
    permissions: isSystemAdmin
      ? [...ALL_SYSTEM_MODULES, "*", "admin"]
      : navigationModules(
          authenticated.module_access || authenticated.permissions || [],
        ),
    doctorId: role === "ROLE_DOCTOR" ? authenticated.employee_id : undefined,
  }
}

export default function Login({ onLogin }: LoginProps) {
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [doctorId, setDoctorId] = useState(DOCTOR_ROSTER[0]?.id || "")
  const [openRoleDropdown, setOpenRoleDropdown] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState("")
  const [selectedLoginRole, setSelectedLoginRole] = useState("")
  const [loginRoles, setLoginRoles] = useState<LoginRoleOption[]>(ROLES_LIST)
  const [roleLoginUsers, setRoleLoginUsers] = useState<RoleLoginUser[]>([])
  const [roleUsersLoading, setRoleUsersLoading] = useState(false)
  const [loginSummary, setLoginSummary] = useState<LoginSummary | null>(null)

  const detectedDoctor = useMemo(() => {
    const k = user.trim().toLowerCase()
    if (!k || k === "admin" || k === "doctor" || k === "nurse" || k === "reception" || k === "pharmacy" || k === "lab" || k === "hr" || k === "billing") {
      return null
    }
    const all = getAllDoctorAccounts()
    return (
      all.find(
        (d) =>
          d.username.toLowerCase() === k ||
          d.id.toLowerCase() === k ||
          d.staffId.toLowerCase() === k ||
          normalizeDoctorName(d.name) === normalizeDoctorName(k),
      ) || null
    )
  }, [user])

  const isDoctorLogin =
    user.trim().toLowerCase() === "doctor" ||
    user.trim().toLowerCase().startsWith("doctor") ||
    Boolean(detectedDoctor)
  const activeRole = loginRoles.find((r) => r.value === selectedLoginRole)

  useEffect(() => {
    let active = true
    apiFetch<{ roles: Array<{ id: string; name: string; description?: string }> }>("/api/auth/login-roles")
      .then((response) => {
        if (!active) return
        const addedRoles = (response.roles || [])
          .filter((role) => role.id && role.name)
          .map((role) => ({
            value: role.id,
            label: role.name,
            sub: role.description || "Assigned access is applied after sign-in",
          }))
        setLoginRoles([
          ...ROLES_LIST,
          ...addedRoles.filter((role) => !ROLES_LIST.some((systemRole) => systemRole.value === role.value)),
        ])
      })
      .catch(() => {
        // Authentication remains available if the optional role catalogue is unavailable.
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    apiFetch<LoginSummary>("/api/auth/login-summary")
      .then((summary) => {
        if (active) setLoginSummary(summary)
      })
      .catch(() => {
        // The sign-in form remains usable if aggregate display data is unavailable.
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    setRoleLoginUsers([])
    // System Admin is a platform account, not a hospital role record.
    if (!selectedLoginRole || selectedLoginRole === "admin") return () => { active = false }
    setRoleUsersLoading(true)
    apiFetch<{ users: RoleLoginUser[] }>(`/api/auth/login-roles/${encodeURIComponent(selectedLoginRole)}/users`)
      .then((response) => {
        if (active) setRoleLoginUsers(response.users || [])
      })
      .catch(() => {
        if (active) setRoleLoginUsers([])
      })
      .finally(() => {
        if (active) setRoleUsersLoading(false)
      })
    return () => { active = false }
  }, [selectedLoginRole])

  const availableStaffList: StaffOption[] = useMemo(() => {
    if (!user) return []
    if (detectedDoctor) {
      return [
        {
          id: detectedDoctor.id,
          name: detectedDoctor.name,
          subtitle: `${detectedDoctor.specialty} · ${detectedDoctor.room}`,
          department: detectedDoctor.specialty,
        },
      ]
    }
    const roleKey = user.trim().toLowerCase()
    const hrmsStaff = HrmsDatabase.getStaffList()

    if (roleKey === "admin" || roleKey.includes("admin")) {
      return [
        {
          id: "ADM-001",
          name: "System Administrator",
          subtitle: "System Administrator · Administration",
          department: "Administration",
        },
      ]
    }

    if (roleKey.includes("lab")) {
      return [
        {
          id: "LAB-001",
          name: "Laboratory Technician",
          subtitle: "Laboratory Technician · Pathology & Diagnostics",
          department: "Laboratory",
        },
      ]
    }

    if (roleKey.includes("pharm")) {
      return [
        {
          id: "PHARM-001",
          name: "Chief Pharmacist",
          subtitle: "Chief Pharmacist · Pharmacy & Dispensary",
          department: "Pharmacy",
        },
      ]
    }

    if (roleKey.includes("nurse")) {
      return [
        {
          id: "NUR-001",
          name: "Senior Staff Nurse",
          subtitle: "Staff Nurse · Nursing & Inpatient",
          department: "Nursing",
        },
      ]
    }

    if (hrmsStaff.length > 0) {
      return hrmsStaff.map((s) => ({
        id: s.id,
        name: s.name,
        subtitle: `${s.designation} · ${s.department}`,
        department: s.department,
      }))
    }

    return [
      {
        id: "STF-001",
        name: "Hospital Staff Member",
        subtitle: "Staff Identity · Clinical Operations",
        department: "Operations",
      },
    ]
  }, [user])

  useEffect(() => {
    if (availableStaffList.length > 0) {
      setSelectedStaffId(availableStaffList[0].id)
      if (isDoctorLogin) {
        setDoctorId(availableStaffList[0].id)
      }
    } else {
      setSelectedStaffId("")
    }
  }, [availableStaffList, isDoctorLogin])

  const submit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault()
    }
    const cleanUser = (user || (selectedLoginRole === "admin" ? "admin" : "")).trim()
    const cleanPass = pass || (cleanUser.toLowerCase().includes("admin") ? "password123" : "")

    if (!cleanUser) {
      setError("Enter your user ID and password to sign in.")
      return
    }

    const isAdminLogin =
      cleanUser.toLowerCase() === "admin" ||
      cleanUser.toLowerCase() === "administrator" ||
      cleanUser.toLowerCase() === "sysadmin" ||
      cleanUser.toLowerCase() === "adm-001" ||
      cleanUser.toLowerCase().includes("admin") ||
      cleanUser.toLowerCase().includes("sysadmin") ||
      cleanUser.toLowerCase().includes("system admin") ||
      cleanUser.toLowerCase().includes("system administration") ||
      selectedLoginRole === "admin" ||
      selectedLoginRole === "ROLE_ADMIN"

    const username = isAdminLogin ? "admin" : cleanUser
    const password = cleanPass || "password123"
    const roleIdToSend = isAdminLogin ? "ROLE_ADMIN" : (selectedLoginRole || undefined)

    setError("")
    setLoading(true)
    try {
      const response = await apiFetch<{ user: AuthenticatedUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          selected_role_id: roleIdToSend,
        }),
      })
      const authenticated = response.user
      if (!authenticated?.username) throw new Error("Invalid authentication response")

      const loginUser = loginUserFromAuthenticated(authenticated)
      if (loginUser.role === "ROLE_DOCTOR") {
        loginUser.doctorId = detectedDoctor?.id || doctorId || authenticated.employee_id
        loginUser.staffId = authenticated.employee_id || detectedDoctor?.staffId || authenticated.username
        loginUser.staffName = authenticated.full_name || detectedDoctor?.name || authenticated.username
        loginUser.staffDepartment = authenticated.department || detectedDoctor?.specialty || "Hospital Operations"
      }
      onLogin(loginUser)
    } catch (err) {
      console.warn("Login submission failed", err)
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please check your credentials.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="h-screen flex"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-[#0C1524] p-12 select-none relative overflow-hidden">
        {/* Bottom curve: white inside dark blue panel (lowered) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          viewBox="0 0 500 1000"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M 0 920 C 130 860, 280 740, 500 840 L 500 1000 L 0 1000 Z"
            fill="#F0F2F5"
          />
        </svg>

        <div className="relative z-10">
          {/* Logo */}
          <div className="mb-6">
            <HospAILogo variant="horizontal" className="h-40" />
          </div>

          {/* Title & Subtitle directly below Logo */}
          <div className="mb-12">
            <h1 className="text-white text-3xl font-bold leading-snug mb-3">
              Universal Hospital
              <br />
              Management System
            </h1>
            <p className="text-[#94A3B8] text-[13.5px] leading-relaxed max-w-lg">
              Enterprise-grade clinical operations platform for physicians,
              nurses, pharmacists, laboratory staff, and administrators.
            </p>
          </div>

          {/* 4 Feature Boxes in 2x2 Grid Container */}
          <div className="grid grid-cols-2 gap-3.5 mb-10">
            {[
              {
                icon: "🏥",
                label: `${loginSummary?.available_modules ?? "—"} Access Modules`,
                sub: "Available for role assignment",
              },
              {
                icon: "👥",
                label: `${loginSummary?.active_roles ?? "—"} Active Roles`,
                sub: "Customize access before assignment",
              },
              {
                icon: "👤",
                label: `${loginSummary?.active_staff ?? "—"} Active Staff`,
                sub: "Role-based staff workspaces",
              },
              {
                icon: "🔒",
                label: loginSummary?.security || "Server-side RBAC",
                sub: "Permissions verified on every request",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 p-3.5 rounded-none bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
              >
                <span className="text-xl flex-shrink-0">{f.icon}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">
                    {f.label}
                  </div>
                  <div className="text-[11.5px] text-[#94A3B8] truncate">
                    {f.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer with Kalpra Tech logo at the complete bottom right (inside white curve) */}
        <div className="absolute bottom-2 right-8 z-10 flex items-center gap-2">
          <span className="text-[11.5px] text-[#475569] font-medium whitespace-nowrap mb-0.5">
            Powered by
          </span>
          <KalpraLogo className="h-25" />
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-between bg-[#F0F2F5] px-8 py-10 relative overflow-hidden">
        {/* Bottom curve: #0C1524 dark blue inside white panel (lowered) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          viewBox="0 0 500 1000"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M 0 840 C 230 940, 370 820, 500 760 L 500 1000 L 0 1000 Z"
            fill="#0C1524"
          />
        </svg>

        <div className="w-full max-w-sm mx-auto my-auto relative z-10">
          <div className="flex justify-center mb-6 lg:hidden">
            <HospAILogo variant="horizontal" className="h-16 justify-center" />
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Sign in
            </h2>
            <p className="text-[12.5px] text-[#64748B]">
                Select your role, then sign in with your assigned credentials
            </p>
          </div>

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[12.5px] px-3.5 py-2.5 rounded-none mb-4 flex items-center gap-2">
              <span className="font-bold">⚠</span> {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                User ID / Employee Number
              </label>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Select role below or enter User ID"
                className="w-full border border-[#DDE2EC] rounded-none bg-white text-[13px] px-3.5 py-2.5 focus:outline-none focus:border-[#1B4FD8]"
              />
              <p className="text-[11px] text-[#94A3B8] mt-1">
                Enter your assigned ID, or choose a local demo account below
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[12px] font-semibold text-[#374151]">
                  Password
                </label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setError("Contact your hospital administrator to reset your password.")
                  }}
                  className="text-[11.5px] text-[#64748B] hover:text-[#1B4FD8]"
                >
                  Reset password
                </a>
              </div>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-[#DDE2EC] rounded-none bg-white text-[13px] px-3.5 py-2.5 focus:outline-none focus:border-[#1B4FD8]"
              />
            </div>

            {/* Clean Minimalistic Custom Role Dropdown */}
            <div className="relative">
              <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                Role
              </label>

              <button
                type="button"
                onClick={() => setOpenRoleDropdown((prev) => !prev)}
                className="w-full border border-[#DDE2EC] rounded-none bg-white text-[13px] px-3.5 py-2.5 flex items-center justify-between text-left focus:outline-none focus:border-[#1B4FD8] hover:border-[#CBD5E1] transition-colors cursor-pointer"
              >
                <div className="min-w-0 pr-2 truncate">
                  {activeRole ? (
                    <>
                      <span className="font-semibold text-[#0F172A]">
                        {activeRole.label}
                      </span>
                      <span className="text-[11.5px] text-[#64748B] ml-2 font-normal">
                        — {activeRole.sub}
                      </span>
                    </>
                  ) : (
                    <span className="text-[#94A3B8] font-medium">
                      Select Role
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-[#64748B] transition-transform duration-150 flex-shrink-0 ${openRoleDropdown ? "rotate-180 text-[#1B4FD8]" : ""
                    }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {openRoleDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#CBD5E1] shadow-lg rounded-none z-50 max-h-60 overflow-y-auto py-1 divide-y divide-[#F1F5F9]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLoginRole("")
                      setOpenRoleDropdown(false)
                    }}
                    className={`w-full px-3.5 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${selectedLoginRole === ""
                      ? "bg-[#EFF6FF] text-[#1B4FD8]"
                      : "hover:bg-[#F8FAFC] text-[#64748B]"
                      }`}
                  >
                    <span className="text-[12.5px] font-medium text-[#64748B]">
                      Select Role
                    </span>
                    {selectedLoginRole === "" && (
                      <span className="text-[#1B4FD8] font-bold text-[12px] ml-2">
                        ✓
                      </span>
                    )}
                  </button>
                  {loginRoles.map((r) => {
                    const isSelected = selectedLoginRole === r.value
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => {
                          setSelectedLoginRole(r.value)
                          if (r.value === "admin" || r.value === "ROLE_ADMIN") {
                            setUser("admin")
                            setPass("password123")
                            setError("")
                          }
                          setOpenRoleDropdown(false)
                        }}
                        className={`w-full px-3.5 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${isSelected
                          ? "bg-[#EFF6FF] text-[#1B4FD8]"
                          : "hover:bg-[#F8FAFC] text-[#334155]"
                          }`}
                      >
                        <div className="min-w-0 truncate">
                          <span
                            className={`text-[12.5px] ${isSelected
                              ? "font-bold text-[#1B4FD8]"
                              : "font-medium text-[#0F172A]"
                              }`}
                          >
                            {r.label}
                          </span>
                          <span className="text-[11px] text-[#64748B] ml-2 font-normal">
                            — {r.sub}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="text-[#1B4FD8] font-bold text-[12px] ml-2">
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {selectedLoginRole === "admin" ? (
              <div className="bg-emerald-50 border border-emerald-300 p-2.5 text-[11.5px] text-emerald-900">
                <span className="font-bold text-emerald-800">✓ System Admin Selected:</span>{" "}
                User ID <code className="bg-emerald-100 font-bold px-1 py-0.2 rounded font-mono">admin</code> and default password <code className="bg-emerald-100 font-bold px-1 py-0.2 rounded font-mono">password123</code> are pre-filled. Click Sign In to enter.
              </div>
            ) : selectedLoginRole ? (
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] px-3 py-2 text-[11.5px] text-[#334155]">
                <span className="font-semibold text-[#1B4FD8]">{activeRole?.label}</span>{" "}
                selected. Use the User ID and password issued by your System Administrator. Your account’s assigned role controls access after sign-in.
              </div>
            ) : null}

            {selectedLoginRole && selectedLoginRole !== "admin" && (
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                  Select your active staff identity
                </label>
                <select
                  value={roleLoginUsers.some((staff) => staff.employee_id === user) ? user : ""}
                  onChange={(e) => setUser(e.target.value)}
                  disabled={roleUsersLoading}
                  className="w-full border border-[#DDE2EC] rounded-none bg-white text-[13px] px-3.5 py-2.5 focus:outline-none focus:border-[#1B4FD8] disabled:bg-slate-50"
                >
                  <option value="">
                    {roleUsersLoading ? "Loading active users…" : "Choose your name (or enter ID above)"}
                  </option>
                  {roleLoginUsers.map((staff) => (
                    <option key={staff.id} value={staff.employee_id}>
                      {staff.full_name} — {staff.employee_id}{staff.department ? ` (${staff.department})` : ""}
                    </option>
                  ))}
                </select>
                {!roleUsersLoading && roleLoginUsers.length === 0 && (
                  <p className="mt-1 text-[11px] text-[#B45309]">
                    No active staff account is assigned to this role yet.
                  </p>
                )}
              </div>
            )}

            {user && !selectedLoginRole && (
              availableStaffList.length > 0 ? (
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1.5 flex items-center justify-between">
                    <span>Select Staff Member / Identity</span>
                    <span className="text-[10.5px] font-mono text-[#1B4FD8] bg-blue-50 px-1.5 py-0.5 rounded">
                      {availableStaffList.length} registered
                    </span>
                  </label>
                  <select
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value)
                      if (isDoctorLogin) setDoctorId(e.target.value)
                    }}
                    className="w-full border border-[#DDE2EC] rounded-none bg-white text-[13px] px-3.5 py-2.5 focus:outline-none focus:border-[#1B4FD8] cursor-pointer font-medium text-[#0F172A]"
                  >
                    {availableStaffList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} — {st.subtitle} ({st.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    {isDoctorLogin
                      ? "Your portal lists only the patients appointed to you, and applies leave under your name."
                      : "Logging in as this individual connects your personal workspace, shifts, and leave quota."}
                  </p>
                </div>
              ) : (
                user.trim().toLowerCase() !== "admin" && (
                  <div className="bg-[#F8FAFC] border border-dashed border-[#CBD5E1] p-3 text-[11.5px] text-[#64748B] rounded">
                    ℹ️ No personnel registered in this role yet. Sign in as <span className="font-semibold text-[#1B4FD8]">HR Administrator</span> (username <code className="bg-slate-200 px-1 rounded">hr</code>) to add staff via the HRMS module.
                  </div>
                )
              )
            )}

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="mfa"
                className="w-3.5 h-3.5 accent-[#1B4FD8] rounded-none"
                defaultChecked
              />
              <label htmlFor="mfa" className="text-[12px] text-[#64748B]">
                Remember this device for 8 hours
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded-none text-white font-semibold text-[13px] transition-colors mt-3 ${loading
                ? "bg-[#94A3B8] cursor-not-allowed"
                : "bg-[#1B4FD8] hover:bg-[#1740B4]"
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="white"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="white"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                "Sign In to HMS"
              )}
            </button>
          </form>
        </div>

        {/* Footer on right side (inside dark blue curve) */}
        <div className="relative z-10 text-center">
          <div className="text-[11px] text-[#94A3B8]">
            © 2026 General Hospital · UHMS v4.2.1 · Build 20260823
          </div>
        </div>
      </div>
    </div>
  )
}
