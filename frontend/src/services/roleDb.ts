import { getDoctorMaster, DOCTOR_LOCAL_PASSWORD } from "./doctorMaster"
import { credentialsForRole } from "../lib/demoCredentials"

export interface AppRole {
  id: string

  name: string

  allowedModules: string[]
}

export interface AppUser {
  id: string

  username: string

  password?: string // Stored just for mock login validation

  roleId: string

  name: string

  staffId: string

  status?: "Active" | "Inactive"
}

// v12: billing split into per-counter pages (billing_op/ip/er/unified/revenue).
// v14: insurance claims moved to the Insurance department (insurance_eligibility
//      sub-page); the short-lived billing_insurance desk is gone.
// v15: "billing" became the Billing Dashboard.
// v16: Insurance department split into dashboard, eligibility & pre-auth,
//      claims, queries, settlement and masters pages.
// v17: Insurance Desk became the landing page; old dashboard moved to insurance_overview.
// v18: Insurance split into dashboard, work desk, pre-auth, claims, queries,
//      settlements, reconciliation and five master pages.
// v19: insurance.* action permissions; Insurance Officer, Finance and Billing roles.
// v20: Added dedicated Email & TPA Decision Hub (insurance_emails) to Insurance suite.
// v27: Added radiology_reports and radiology_templates submodules to Enterprise Radiology.
// v28: Guaranteed full pharmacy submodules across Doctor and Pharmacist roles.
const ROLES_STORAGE_KEY = "hospai_rbac_roles_v29"

const USERS_STORAGE_KEY = "hospai_rbac_users_v2"

export const ALL_SYSTEM_MODULES = [
  "dashboard",
  "patients",
  "appointments",
  "emergency",

  "clinical",
  "inpatient",
  "nursing",
  "laboratory",

  "radiology",
  "radiology_reports",
  "radiology_templates",
  "pharmacy",
  "pharmacy_dispensing",
  "pharmacy_rx",
  "pharmacy_ocr",
  "pharmacy_returns",
  "pharmacy_supplier_returns",

  "pharmacy_medicine",
  "pharmacy_category",
  "pharmacy_suppliers",
  "pharmacy_po",

  "pharmacy_grn",
  "pharmacy_ledger",
  "pharmacy_transfers",
  "pharmacy_expiry",
  "pharmacy_write_off",
  "pharmacy_analytics",

  "pharmacy_notifications",
  "pharmacy_users",
  "pharmacy_audit",
  "pharmacy_settings",

  "surgery",
  "billing",
  "billing_op",
  "billing_ip",
  "billing_er",
  "billing_unified",
  "billing_revenue",

  "icu",
  "discharge",
  "triage",
  "insurance",
  "insurance_overview",
  "insurance_desk",
  "insurance_preauth",
  "insurance_reconciliation",
  "insurance_tpas",
  "insurance_packages",
  "insurance_pricing",
  "insurance_docrules",
  "insurance_eligibility",
  "insurance_claims",
  "insurance_queries",
  "insurance_emails",
  "insurance_settlement",
  "insurance_masters",
  "analytics",

  "reports",
  "reports_overview",
  "reports_patients",
  "reports_op",
  "reports_er",
  "reports_inpatient",

  "reports_appointments",
  "reports_doctors",
  "reports_pharmacy",
  "reports_laboratory",
  "reports_radiology",

  "reports_beds",
  "reports_admissions",
  "reports_discharges",
  "reports_staff",

  "admin",
  "chart",
  "register",

  "outpatient",
  "queue",
  "op_management",
  "op_registration",
  "op_workflow",
  "op_nurse",

  "doctor_workflow",
  "doctor_portal",
  "scheduling",
  "admissions",
  "readmission",
  "lab_billing",

  "payments",
  "revenue_reports",
  "reports_pharmacy_damaged",
  "reports_supplier_returns",
  "hrms",
  "employees",
  "hr_attendance",
  "hr_staffing",
  "hr_leave",
  "hr_approvals",
  "hr_payroll",
  "hr_recruitment",
  "hr_organization",
  "hr_training",
  "hr_performance",
  "hr_compliance",
  "hr_grievances",
  "hr_reports",
  "hr_announcements",
  "patient_exp",
  "patient_messages",

  "intelligence",
  "ocr",
  "dpi_ocr",
  "symptom_ai",
  "clinical_rag",
  "clinical_summaries",
  "bulk_ai",
  "nl_filtering",

  "beds",
  "accounts",
  "accounts_dashboard",
  "accounts_coa",
  "accounts_gl",
  "accounts_receipts",
  "accounts_payments",
  "accounts_ar",
  "accounts_ap",
  "accounts_cash_bank",
  "accounts_pharmacy",
  "accounts_insurance",
  "accounts_tax",
  "accounts_budget",
  "accounts_assets",
  "accounts_cost_centres",
  "accounts_reports",
  "accounts_period_close",
  "accounts_audit",
  "accounts_manager",
]

/**
 * Insurance action permissions. They live in a role's allowedModules next to
 * the module keys. A role that has the "insurance" module but none of these
 * keeps full insurance access (as before they existed); a role that lists any
 * of them gets exactly those. Enforced by the insurance engine itself.
 */
export const INSURANCE_PERMISSIONS = {
  "insurance.view": "View insurance cases",
  "insurance.create": "Capture insurance / open a case",
  "insurance.verify": "Verify eligibility",
  "insurance.preauth.create": "Prepare pre-authorisation",
  "insurance.preauth.submit": "Submit pre-auth & record insurer replies",
  "insurance.claim.create": "Prepare claim, documents and discharge",
  "insurance.claim.submit": "Submit claim & record decisions",
  "insurance.query.respond": "Respond to insurer queries",
  "insurance.settlement.view": "View settlements",
  "insurance.reconciliation.manage": "Record payments & reconcile",
  "insurance.master.manage": "Manage insurance masters",
} as const
export type InsurancePermission = keyof typeof INSURANCE_PERMISSIONS
const ALL_INSURANCE_PERMISSIONS = Object.keys(INSURANCE_PERMISSIONS) as InsurancePermission[]
const INSURANCE_PAGES = ["insurance", "insurance_desk", "insurance_preauth", "insurance_claims", "insurance_queries", "insurance_emails", "insurance_settlement", "insurance_reconciliation"]
const INSURANCE_MASTER_PAGES = ["insurance_masters", "insurance_tpas", "insurance_packages", "insurance_pricing", "insurance_docrules"]

// Super admin role gets everything

const INITIAL_ROLES: AppRole[] = [
  {
    id: "ROLE_ADMIN",
    name: "System Administrator",
    allowedModules: ALL_SYSTEM_MODULES,
  },
]

// Employee self-service ("My HR") for every staff login. Administrators use
// HR & Staff instead; the page answers only from the signed-in user's own
// record, so granting it widely exposes nothing.
for (const role of INITIAL_ROLES) {
  if (role.allowedModules !== ALL_SYSTEM_MODULES && !role.allowedModules.includes("my_hr")) {
    role.allowedModules = [...role.allowedModules, "my_hr"]
  }
}

export function getInitialUsers(): AppUser[] {
  return [
    {
      id: "U_ADMIN",
      username: "admin",
      password: "password123",
      roleId: "ROLE_ADMIN",
      name: "System Administrator",
      staffId: "ADM-001",
      status: "Active",
    },
  ]
}

export class RoleDatabase {
  static getRoles(): AppRole[] {
    if (typeof window === "undefined") return INITIAL_ROLES

    try {
      const stored = window.localStorage.getItem(ROLES_STORAGE_KEY)

      if (!stored) {
        window.localStorage.setItem(
          ROLES_STORAGE_KEY,
          JSON.stringify(INITIAL_ROLES),
        )

        return INITIAL_ROLES
      }

      const parsed: AppRole[] = JSON.parse(stored)
      const legacySeedRoleIds = new Set([
        "ROLE_SUPERADMIN",
        "ROLE_HR",
        "ROLE_STAFF",
        "ROLE_DOCTOR",
        "ROLE_RECEPTION",
        "ROLE_INSURANCE",
        "ROLE_FINANCE",
        "ROLE_BILLING",
        "ROLE_PHARMACY",
        "ROLE_LAB",
        "ROLE_NURSE",
        "ROLE_PHARMACY_MANAGER",
        "ROLE_PHARMACIST",
        "ROLE_PHARMACY_ASSISTANT",
      ])
      const cleaned = parsed.filter((r) => r && !legacySeedRoleIds.has(r.id))
      let changed = false
      if (cleaned.length !== parsed.length) {
        changed = true
      }
      const adminRole = cleaned.find((r) => r.id === "ROLE_ADMIN")
      if (!adminRole) {
        cleaned.unshift(INITIAL_ROLES[0])
        changed = true
      } else {
        if (adminRole.name !== "System Administrator" || adminRole.allowedModules !== ALL_SYSTEM_MODULES) {
          adminRole.name = "System Administrator"
          adminRole.allowedModules = ALL_SYSTEM_MODULES
          changed = true
        }
      }
      if (changed) {
        window.localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(cleaned))
      }
      return cleaned
    } catch {
      return INITIAL_ROLES
    }
  }

  static saveRoles(roles: AppRole[]): void {
    if (typeof window === "undefined") return

    try {
      window.localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles))
    } catch (e) {
      console.error("Failed to save roles", e)
    }
  }

  static getUsers(): AppUser[] {
    const initial = getInitialUsers()

    if (typeof window === "undefined") return initial

    try {
      const stored = window.localStorage.getItem(USERS_STORAGE_KEY)

      if (!stored) {
        window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial))
        return initial
      }

      const users: AppUser[] = JSON.parse(stored)
      const legacySeedRoleIds = new Set([
        "ROLE_DOCTOR",
        "ROLE_RECEPTION",
        "ROLE_PHARMACY",
        "ROLE_LAB",
        "ROLE_NURSE",
        "ROLE_INSURANCE",
        "ROLE_FINANCE",
        "ROLE_BILLING",
        "ROLE_STAFF",
        "ROLE_HR",
      ])
      const filtered = (users || []).filter(
        (u) =>
          u &&
          u.username !== "superadmin" &&
          u.username !== "hr" &&
          u.username !== "staff" &&
          u.username !== "doctor" &&
          u.username !== "reception" &&
          u.username !== "pharmacy" &&
          u.username !== "lab" &&
          u.username !== "insurance" &&
          u.username !== "finance" &&
          u.username !== "billing" &&
          u.username !== "nurse" &&
          !String(u.staffId).startsWith("IMP-") &&
          !String(u.staffId).startsWith("STF-DOC-") &&
          !String(u.id).startsWith("DOC-") &&
          !String(u.username).startsWith("dr.") &&
          (u.username === "admin" || !legacySeedRoleIds.has(u.roleId))
      )

      if (!filtered.some((u) => u.username === "admin")) {
        filtered.unshift(initial[0])
      }

      if (filtered.length !== users.length) {
        window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(filtered))
      }

      return filtered
    } catch {
      return initial
    }
  }

  static saveUsers(users: AppUser[]): void {
    if (typeof window === "undefined") return

    try {
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))

      window.dispatchEvent(new Event("rbac_users_updated"))
    } catch (e) {
      console.error("Failed to save users", e)
    }
  }

  static upsertUser(user: AppUser): AppUser[] {
    const current = this.getUsers()

    const idx = current.findIndex(
      (u) =>
        u.id === user.id ||
        u.username.toLowerCase() === user.username.toLowerCase(),
    )

    let updated: AppUser[]

    if (idx >= 0) {
      updated = [...current]

      updated[idx] = { ...updated[idx], ...user }
    } else {
      updated = [...current, user]
    }

    this.saveUsers(updated)

    return updated
  }

  static deleteUser(id: string): AppUser[] {
    const current = this.getUsers()

    const updated = current.filter((u) => u.id !== id)

    this.saveUsers(updated)

    return updated
  }

  static authenticate(username: string, password?: string): {
    user: AppUser
    role: AppRole
  } {
    const cleanUser = (username || "admin").trim().toLowerCase()
    const cleanPass = (password || "").trim()

    let users: AppUser[] = []
    try {
      users = this.getUsers()
    } catch {
      users = getInitialUsers()
    }
    const demo = credentialsForRole(cleanUser)

    let user = users.find((u) => {
      if (!u || !u.username) return false
      if (String(u.username).trim().toLowerCase() !== cleanUser) return false
      if (u.status === "Inactive") return false

      // 1. Exact match with stored password
      if (u.password && u.password === cleanPass) return true

      // 2. Demo credentials match
      if (demo) {
        if (cleanPass === demo.localPassword || cleanPass === demo.backendPassword) return true
      }

      // 3. Admin standard allowed credentials
      if (cleanUser === "admin") {
        if (
          !cleanPass ||
          cleanPass === "password123" ||
          cleanPass === "admin" ||
          cleanPass === "Admin@123" ||
          cleanPass === "admin123"
        ) {
          return true
        }
      }

      // 4. Default fallback if password left empty on demo account
      if (!cleanPass && demo) return true

      return false
    })

    if (!user) {
      if (cleanUser === "admin") {
        const initial = getInitialUsers()
        user = initial[0]
      } else {
        throw new Error("Invalid username or password. Only system administrator can log in.")
      }
    }

    let roles: AppRole[] = INITIAL_ROLES
    try {
      const storedRoles = this.getRoles()
      if (Array.isArray(storedRoles) && storedRoles.length > 0) {
        roles = storedRoles
      }
    } catch {
      roles = INITIAL_ROLES
    }

    const role =
      roles.find((r) => r && r.id === user.roleId) ||
      roles.find((r) => r && r.id === "ROLE_ADMIN") ||
      roles[0] ||
      INITIAL_ROLES[0]

    return { user, role }
  }
}

export type PermissionAction = "read" | "write" | "delete" | "export"

export function hasGranularPermission(
  allowedModules: string[],

  moduleName: string,

  action?: PermissionAction,
): boolean {
  if (!allowedModules) return false

  if (allowedModules.includes(moduleName) || allowedModules.includes("*"))
    return true

  if (!action) {
    return allowedModules.some(
      (m) => m === moduleName || m.startsWith(`${moduleName}:`),
    )
  }

  return allowedModules.includes(`${moduleName}:${action}`)
}

export function getGrantedActionsForModule(
  allowedModules: string[],

  moduleName: string,
): PermissionAction[] {
  if (!allowedModules) return []

  if (allowedModules.includes(moduleName) || allowedModules.includes("*")) {
    return ["read", "write", "delete", "export"]
  }

  const actions: PermissionAction[] = []

  if (allowedModules.includes(`${moduleName}:read`)) actions.push("read")

  if (allowedModules.includes(`${moduleName}:write`)) actions.push("write")

  if (allowedModules.includes(`${moduleName}:delete`)) actions.push("delete")

  if (allowedModules.includes(`${moduleName}:export`)) actions.push("export")

  return actions
}

/** Can the signed-in user perform this insurance action? */
export function insuranceCan(perm: InsurancePermission): boolean {
  if (typeof window === "undefined") return true
  let username = ""
  try {
    username = String(JSON.parse(localStorage.getItem("hospai_current_user") || "null")?.user || "")
  } catch {}
  if (!username) return true // no session (tests, background sync) -- nothing to check against
  const user = RoleDatabase.getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase())
  const role = user && RoleDatabase.getRoles().find((r) => r.id === user.roleId)
  if (!role) return true
  const mods = role.allowedModules
  if (role.id === "ROLE_SUPERADMIN" || role.id === "ROLE_ADMIN" || mods.includes("*")) return true
  const explicit = mods.filter((m) => m.startsWith("insurance."))
  if (!explicit.length) return mods.includes("insurance") || INSURANCE_PAGES.some((p) => mods.includes(p))
  return mods.includes(perm)
}

export { INSURANCE_MASTER_PAGES }

