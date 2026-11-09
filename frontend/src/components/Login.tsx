import React, { useState, useEffect, useMemo, useRef } from "react"
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  FlaskConical,
  HeartPulse,
  Loader2,
  Lock,
  Pill,
  Search,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  User,
} from "lucide-react"
import { apiFetch, LOCAL_MOCKS_ENABLED } from "../lib/api"
import { RoleDatabase, ALL_SYSTEM_MODULES, type AppUser } from "../services/roleDb"
import { HospAILogo } from "./HospAILogo"
import { KalpraLogo } from "./KalpraLogo"

interface LoginRoleOption {
  value: string
  label: string
  sub: string
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
  { value: "ROLE_ADMIN", label: "System Administrator", sub: "Master IT Admin & Operations" },
  { value: "ROLE_DOCTOR", label: "Doctor / Physician", sub: "Clinical Workspace, OPD, IPD & EMR" },
  { value: "ROLE_NURSE", label: "Staff Nurse", sub: "Ward Management, Vitals & Nursing Station" },
  { value: "ROLE_PHARMACIST", label: "Chief Pharmacist", sub: "Dispensing & Pharmacy Store" },
  { value: "ROLE_LAB_TECHNICIAN", label: "Laboratory Technician", sub: "Pathology, Diagnostics & Test Reports" },
  { value: "ROLE_RECEPTIONIST", label: "Front Desk Receptionist", sub: "Patient Registration & Appointments" },
  { value: "ROLE_BILLING_EXECUTIVE", label: "Billing & Cashier", sub: "Cashier, Invoicing, TPA & Counter Billing" },
  { value: "ROLE_ACCOUNTANT", label: "Accountant / Finance", sub: "General Ledger, Accounts & P&L" },
  { value: "ROLE_RADIOLOGIST", label: "Radiologist", sub: "Diagnostic Imaging, PACS, DICOM & Reports" },
  { value: "ROLE_INSURANCE_TPA_OFFICER", label: "Insurance / TPA Desk", sub: "Claims, Pre-Auth & Settlements" },
  { value: "ROLE_SURGEON", label: "Surgeon", sub: "Surgical Suite & OT Procedures" },
  { value: "ROLE_ER_PHYSICIAN", label: "Emergency Physician", sub: "Trauma, Resuscitation & Triage" },
]

// Backend grants are domain-oriented; the shell has a few presentation keys
// with different names. Expand only those aliases for navigation visibility.
// This does not grant API permissions: every protected request is still
// authorized by the server-side permission attached to the session.
const NAVIGATION_MODULE_ALIASES: Record<string, string[]> = {
  patients: ["patients", "register", "appointments", "patient_messages", "clinical", "chart", "doctor_portal"],
  clinical: ["clinical", "doctor_portal", "patients", "appointments"],
  doctor_portal: ["doctor_portal", "clinical", "patients", "appointments"],
  op: ["outpatient", "op_management", "queue", "op_nurse", "opd_procedures"],
  er: ["emergency", "triage"],
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
  // System Admin status is decided purely by what the server returned for this
  // authenticated session -- never by guessing from the username string, which
  // would misclassify (or over-grant) any real staff account that happens to
  // contain "admin" in its name or ID.
  const isSystemAdmin =
    authenticated.username?.toLowerCase() === "admin" ||
    authenticated.user_type === "admin" ||
    accessRole === "owner" ||
    assignedRole === "ROLE_ADMIN" ||
    assignedRole === "ROLE_SUPERADMIN"

  const role = isSystemAdmin
    ? "ROLE_ADMIN"
    : assignedRole ||
      (authenticated.user_type === "admin" ? "ROLE_ADMIN" : undefined) ||
      roleByAccess[accessRole] ||
      `ROLE_${(accessRole || "STAFF").toUpperCase()}`

  const isDoctorRole =
    !isSystemAdmin &&
    (role === "ROLE_DOCTOR" ||
      role.includes("DOCTOR") ||
      role === "ROLE_SURGEON" ||
      role === "ROLE_ER_PHYSICIAN" ||
      role === "ROLE_ANESTHETIST" ||
      role.includes("PHYSICIAN") ||
      role.includes("SURGEON") ||
      role.includes("CLINICIAN") ||
      accessRole === "clinician" ||
      accessRole === "doctor" ||
      accessRole === "surgeon" ||
      Boolean((authenticated as any).doctorId) ||
      (authenticated.full_name || (authenticated as any).name || "").toLowerCase().startsWith("dr."))

  return {
    user: authenticated.username,
    role,
    staffId: isSystemAdmin ? "ADM-001" : (authenticated.employee_id || authenticated.username),
    staffName: isSystemAdmin ? (authenticated.full_name || "System Administrator") : (authenticated.full_name || authenticated.username),
    staffTitle: isSystemAdmin
      ? "System Administrator"
      : (authenticated.job_role || (isDoctorRole ? "Consultant Physician" : (accessRole || "Hospital Staff"))),
    staffDepartment: isSystemAdmin
      ? "Administration"
      : (authenticated.department || (isDoctorRole ? "General Medicine" : "Hospital Operations")),
    permissions: isSystemAdmin
      ? [...ALL_SYSTEM_MODULES, "*", "admin"]
      : (() => {
          const perms = navigationModules(
            authenticated.module_access || authenticated.permissions || [],
          )
          if (isDoctorRole && !perms.includes("doctor_portal")) {
            perms.push("doctor_portal")
          }
          return perms
        })(),
    doctorId: isDoctorRole
      ? ((authenticated as any).doctorId || authenticated.employee_id || authenticated.username)
      : undefined,
  }
}

type RoleGroup =
  | "Administration"
  | "Clinical"
  | "Nursing"
  | "Diagnostics"
  | "Pharmacy"
  | "Front Office & Finance"
  | "Operations & HR"

const ROLE_GROUP_ORDER: RoleGroup[] = [
  "Administration",
  "Clinical",
  "Nursing",
  "Diagnostics",
  "Pharmacy",
  "Front Office & Finance",
  "Operations & HR",
]

const ROLE_GROUP_ICON: Record<RoleGroup, React.ComponentType<{ className?: string }>> = {
  Administration: ShieldCheck,
  Clinical: Stethoscope,
  Nursing: HeartPulse,
  Diagnostics: FlaskConical,
  Pharmacy: Pill,
  "Front Office & Finance": ClipboardList,
  "Operations & HR": Briefcase,
}

function roleGroupOf(role: LoginRoleOption): RoleGroup {
  const k = `${role.value} ${role.label}`.toUpperCase()
  if (/ADMIN|IT_SUPPORT|IT SUPPORT|COMPLIANCE/.test(k)) return "Administration"
  if (/NURS/.test(k)) return "Nursing"
  if (/LAB|PATHOLOG|RADIOLOG/.test(k)) return "Diagnostics"
  if (/PHARM/.test(k)) return "Pharmacy"
  if (/DOCTOR|PHYSICIAN|SURGEON|ANESTHET|PHYSIO|CLINIC/.test(k)) return "Clinical"
  if (/RECEPTION|FRONT|BILLING|CASHIER|ACCOUNT|FINANCE|INSURANCE|TPA|RECORDS/.test(k)) return "Front Office & Finance"
  return "Operations & HR"
}

// Only the last chosen role (never a username or password) is remembered,
// so returning staff land directly on the credentials step.
const LAST_ROLE_KEY = "hospai_login_last_role"

function readLastRole(): string {
  try {
    return window.localStorage.getItem(LAST_ROLE_KEY) || ""
  } catch {
    return ""
  }
}

function writeLastRole(roleId: string | null) {
  try {
    if (roleId) window.localStorage.setItem(LAST_ROLE_KEY, roleId)
    else window.localStorage.removeItem(LAST_ROLE_KEY)
  } catch {
    // storage unavailable -- nothing to remember
  }
}

export default function Login({ onLogin }: LoginProps) {
  const [step, setStep] = useState<"role" | "credentials">("role")
  const [user, setUser] = useState("")
  const [pass, setPass] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [roleQuery, setRoleQuery] = useState("")
  const [selectedLoginRole, setSelectedLoginRole] = useState("")
  const [loginRoles, setLoginRoles] = useState<LoginRoleOption[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  const [loginSummary, setLoginSummary] = useState<LoginSummary | null>(null)
  const userInputRef = useRef<HTMLInputElement>(null)

  const activeRole = loginRoles.find((r) => r.value === selectedLoginRole)

  // The hospital's active roles come from the server -- the same role keys that
  // accounts are assigned to. The built-in list is only an offline fallback.
  useEffect(() => {
    let active = true
    const describe = (id: string, description?: string) =>
      description ||
      ROLES_LIST.find((r) => r.value.toUpperCase() === id.toUpperCase())?.sub ||
      "Hospital role"

    apiFetch<{ roles: Array<{ id: string; name: string; description?: string }> }>("/api/auth/login-roles")
      .then((response) => {
        if (!active) return
        const roles = (response.roles || [])
          .filter((role) => role.id && role.name)
          .map((role) => ({ value: role.id, label: role.name, sub: describe(role.id, role.description) }))
        if (!roles.length) throw new Error("No roles configured")
        setLoginRoles(roles)
      })
      .catch(() => {
        if (!active) return
        let localRoles: LoginRoleOption[] = []
        try {
          localRoles = RoleDatabase.getRoles().map((r) => ({
            value: r.id,
            label: r.name,
            sub: r.isSystem ? "Built-in role" : "Hospital role",
          }))
        } catch {}
        setLoginRoles([
          ...ROLES_LIST,
          ...localRoles.filter((role) => !ROLES_LIST.some((systemRole) => systemRole.value === role.value)),
        ])
      })
      .finally(() => {
        if (active) setRolesLoading(false)
      })
    return () => { active = false }
  }, [])

  // Returning staff: jump straight to credentials for their remembered role.
  useEffect(() => {
    if (rolesLoading || selectedLoginRole) return
    const last = readLastRole()
    if (last && loginRoles.some((r) => r.value === last)) {
      setSelectedLoginRole(last)
      setStep("credentials")
    }
  }, [rolesLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true
    apiFetch<LoginSummary>("/api/auth/login-summary")
      .then((summary) => {
        if (active) setLoginSummary(summary)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (step === "credentials") userInputRef.current?.focus()
  }, [step])

  const groupedRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase()
    const matches = loginRoles.filter(
      (r) => !q || r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q),
    )
    const byGroup = new Map<RoleGroup, LoginRoleOption[]>()
    for (const role of matches) {
      const g = roleGroupOf(role)
      byGroup.set(g, [...(byGroup.get(g) || []), role])
    }
    return ROLE_GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
      group: g,
      roles: byGroup.get(g)!.sort((x, y) => x.label.localeCompare(y.label)),
    }))
  }, [loginRoles, roleQuery])

  const chooseRole = (roleId: string) => {
    setSelectedLoginRole(roleId)
    setError("")
    setStep("credentials")
  }

  const backToRoles = () => {
    setStep("role")
    setPass("")
    setShowPass(false)
    setError("")
  }

  const submit = async (e?: React.FormEvent) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault()
    }
    const username = user.trim()
    const password = pass

    if (!selectedLoginRole) {
      setStep("role")
      setError("Please select your role to continue.")
      return
    }
    if (!username || !password) {
      setError("Enter the User ID and password issued by your administrator.")
      return
    }

    // The username and password are sent exactly as entered -- the server is
    // the sole authority on who this account is. The selected role is checked
    // server-side against the role the administrator assigned to the account.
    const roleIdToSend = selectedLoginRole

    setError("")
    setLoading(true)

    // Offline / standalone development only: a local account matched by the exact
    // password the administrator stored for it, and by the selected role.
    // Disabled in deployed builds, and never used to override the server.
    let foundUser: AppUser | undefined
    if (LOCAL_MOCKS_ENABLED) {
      try {
        const local = RoleDatabase.authenticate(username, password)?.user
        const localIsAdmin = local?.roleId === "ROLE_ADMIN" || local?.username.toLowerCase() === "admin"
        if (local && (localIsAdmin || local.roleId === roleIdToSend)) foundUser = local
      } catch {
        // ignore
      }
    }

    try {
      let authenticated: AuthenticatedUser | undefined
      try {
        const response = await apiFetch<{ user?: AuthenticatedUser; error?: string }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username,
            password,
            selected_role_id: roleIdToSend,
          }),
          timeoutMs: LOCAL_MOCKS_ENABLED ? 1500 : 15000,
        })
        if (response?.error) {
          throw Object.assign(new Error(response.error), { status: 401 })
        }
        authenticated = response?.user
      } catch (backendErr: any) {
        const status = backendErr?.status
        if (typeof status === "number" && status < 500 && status !== 404) {
          // The server answered (wrong credentials, inactive account, role
          // mismatch, ...). Its decision is final.
          throw backendErr
        }
        if (!foundUser) throw backendErr
        console.warn("Backend authentication unreachable, using local development account", backendErr)
      }

      if (!authenticated?.username && foundUser) {
        const roles = RoleDatabase.getRoles()
        const userRole = roles.find((r) => r.id === foundUser.roleId)
        const isSuperAdmin =
          foundUser.username.toLowerCase() === "admin" ||
          foundUser.roleId === "ROLE_ADMIN" ||
          (userRole?.name || "").toLowerCase().includes("admin")

        authenticated = {
          username: foundUser.username,
          role_key: isSuperAdmin ? "ROLE_ADMIN" : (foundUser.roleId || `ROLE_${foundUser.username.toUpperCase()}`),
          user_type: isSuperAdmin ? "admin" : "staff",
          full_name: foundUser.name,
          employee_id: foundUser.staffId || foundUser.id,
          department: foundUser.department || "Administration",
          permissions: isSuperAdmin
            ? [...ALL_SYSTEM_MODULES, "*", "admin"]
            : (userRole?.allowedModules && userRole.allowedModules.length > 0
                ? userRole.allowedModules
                : ALL_SYSTEM_MODULES),
        }
      }

      if (authenticated?.username) {
        writeLastRole(rememberDevice ? roleIdToSend : null)
        const loginUser = loginUserFromAuthenticated(authenticated)
        onLogin(loginUser)
        return
      }

      throw new Error("Invalid username or password.")
    } catch (err: any) {
      console.warn("Login submission failed", err)
      const message =
        err instanceof Error && err.message && err.message !== "Invalid authentication response"
          ? err.message
          : "Invalid username or password."
      setError(message)
      setPass("")
    } finally {
      setLoading(false)
    }
  }

  const ActiveRoleIcon = activeRole ? ROLE_GROUP_ICON[roleGroupOf(activeRole)] : ShieldCheck
  const inputCls =
    "w-full border border-[#DDE2EC] rounded-none bg-white text-[13px] pl-10 pr-3.5 py-2.5 text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1B4FD8] focus:ring-2 focus:ring-[#1B4FD8]/15 transition-shadow"

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
      <div className="flex-1 flex flex-col justify-between bg-[#F0F2F5] px-4 sm:px-8 py-10 relative overflow-hidden">
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

        <div className="w-full max-w-md mx-auto my-auto relative z-10">
          <div className="flex justify-center mb-6 lg:hidden">
            <HospAILogo variant="horizontal" className="h-16 justify-center" />
          </div>

          <div className="bg-white border border-[#E2E8F0] shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
            {/* Step indicator */}
            <div className="px-6 pt-5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-2">
                <span>Step {step === "role" ? 1 : 2} of 2</span>
                <span className="text-[#1B4FD8]">{step === "role" ? "Select role" : "Verify identity"}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="h-1 bg-[#1B4FD8]" />
                <div className={`h-1 transition-colors ${step === "credentials" ? "bg-[#1B4FD8]" : "bg-[#E2E8F0]"}`} />
              </div>
            </div>

            <div className="px-6 pt-5 pb-6">
              {error && (
                <div
                  role="alert"
                  className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[12.5px] px-3.5 py-2.5 mb-4 flex items-start gap-2"
                >
                  <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-px" />
                  <span>{error}</span>
                </div>
              )}

              {step === "role" ? (
                <>
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Select your role</h2>
                    <p className="text-[12.5px] text-[#64748B]">
                      Choose the role your administrator assigned to your account.
                    </p>
                  </div>

                  <div className="relative mb-3">
                    <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      value={roleQuery}
                      onChange={(e) => setRoleQuery(e.target.value)}
                      placeholder="Search roles"
                      aria-label="Search roles"
                      className={inputCls}
                      autoFocus
                    />
                  </div>

                  <div className="max-h-[22rem] overflow-y-auto -mx-1 px-1" role="listbox" aria-label="Roles">
                    {rolesLoading ? (
                      <div className="space-y-2" aria-busy="true">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="h-[52px] bg-[#F1F5F9] animate-pulse" />
                        ))}
                      </div>
                    ) : groupedRoles.length === 0 ? (
                      <div className="text-center text-[12.5px] text-[#64748B] py-10 border border-dashed border-[#DDE2EC]">
                        No roles match "{roleQuery}"
                      </div>
                    ) : (
                      groupedRoles.map(({ group, roles }) => {
                        const GroupIcon = ROLE_GROUP_ICON[group]
                        return (
                          <div key={group} className="mb-3 last:mb-0">
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#94A3B8] px-1 mb-1.5">
                              {group}
                            </div>
                            <div className="space-y-1.5">
                              {roles.map((r) => {
                                const isSelected = selectedLoginRole === r.value
                                return (
                                  <button
                                    key={r.value}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => chooseRole(r.value)}
                                    className={`group w-full flex items-center gap-3 px-3 py-2.5 text-left border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4FD8]/30 ${
                                      isSelected
                                        ? "border-[#1B4FD8] bg-[#EFF6FF]"
                                        : "border-[#E2E8F0] bg-white hover:border-[#1B4FD8]/60 hover:bg-[#F8FAFC]"
                                    }`}
                                  >
                                    <span
                                      className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${
                                        isSelected ? "bg-[#1B4FD8] text-white" : "bg-[#EEF2FF] text-[#1B4FD8]"
                                      }`}
                                    >
                                      <GroupIcon className="w-4 h-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-[13px] font-semibold text-[#0F172A] truncate">{r.label}</span>
                                      <span className="block text-[11.5px] text-[#64748B] truncate">{r.sub}</span>
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-[#CBD5E1] group-hover:text-[#1B4FD8] flex-shrink-0 transition-colors" />
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={submit} className="space-y-4" noValidate>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h2>
                    <p className="text-[12.5px] text-[#64748B]">
                      Enter the credentials issued to you by your administrator.
                    </p>
                  </div>

                  {/* Selected role */}
                  <div className="flex items-center gap-3 border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5">
                    <span className="w-8 h-8 flex items-center justify-center bg-[#1B4FD8] text-white flex-shrink-0">
                      <ActiveRoleIcon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#64748B]">Signing in as</div>
                      <div className="text-[13px] font-semibold text-[#0F172A] truncate">
                        {activeRole?.label || selectedLoginRole}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={backToRoles}
                      className="flex items-center gap-1 text-[12px] font-semibold text-[#1B4FD8] hover:underline flex-shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Change
                    </button>
                  </div>

                  <div>
                    <label htmlFor="login-user" className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                      User ID / Employee Number
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-user"
                        ref={userInputRef}
                        value={user}
                        onChange={(e) => setUser(e.target.value)}
                        placeholder="e.g. dr.varma or STF-001"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="login-pass" className="block text-[12px] font-semibold text-[#374151]">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setError("Contact your hospital administrator to reset your password.")}
                        className="text-[11.5px] text-[#64748B] hover:text-[#1B4FD8]"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-pass"
                        type={showPass ? "text" : "password"}
                        value={pass}
                        onChange={(e) => setPass(e.target.value)}
                        onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                        onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                        onBlur={() => setCapsLock(false)}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className={`${inputCls} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        aria-label={showPass ? "Hide password" : "Show password"}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#1B4FD8]"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {capsLock && (
                      <p className="text-[11px] text-[#B45309] mt-1 flex items-center gap-1">
                        <TriangleAlert className="w-3 h-3" /> Caps Lock is on
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember-device"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#1B4FD8] rounded-none"
                    />
                    <label htmlFor="remember-device" className="text-[12px] text-[#64748B]">
                      Remember my role on this device
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-2.5 rounded-none text-white font-semibold text-[13px] transition-colors ${
                      loading ? "bg-[#94A3B8] cursor-not-allowed" : "bg-[#1B4FD8] hover:bg-[#1740B4]"
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying...
                      </span>
                    ) : (
                      "Sign in"
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-[#F1F5F9] bg-[#F8FAFC] px-6 py-3 text-[11px] text-[#64748B]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] flex-shrink-0" />
              Access is verified against the role assigned to your account.
            </div>
          </div>
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
