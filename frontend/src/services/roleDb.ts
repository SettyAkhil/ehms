export interface AppRole {
  id: string

  name: string

  allowedModules: string[]

  /** Inactive roles are retained for audit history but cannot receive staff. */
  status?: "Active" | "Inactive"

  /** Built-in hospital template: editable, but not deletable. */
  isSystem?: boolean
}

export interface AppUser {
  id: string

  username: string

  password?: string // Stored just for mock login validation

  roleId: string

  name: string

  staffId: string

  status?: "Active" | "Inactive"

  department?: string

  /** Individual user-level module overrides */
  allowedModules?: string[]

  /** Explicit custom modules assigned directly to this user account */
  customModules?: string[]
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
    allowedModules: [...ALL_SYSTEM_MODULES, "*"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_DOCTOR",
    name: "Doctor",
    allowedModules: [
      "patients",
      "appointments",
      "clinical",
      "inpatient",
      "emergency",
      "laboratory",
      "radiology",
      "pharmacy",
      "surgery",
      "icu",
      "discharge",
      "triage",
      "my_hr",
    ],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_SURGEON",
    name: "Surgeon",
    allowedModules: [
      "patients",
      "appointments",
      "clinical",
      "inpatient",
      "emergency",
      "surgery",
      "icu",
      "discharge",
      "triage",
      "my_hr",
    ],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_ANESTHETIST",
    name: "Anesthetist",
    allowedModules: ["patients", "clinical", "inpatient", "emergency", "surgery", "icu", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_ER_PHYSICIAN",
    name: "Emergency Physician",
    allowedModules: [
      "patients",
      "appointments",
      "emergency",
      "clinical",
      "inpatient",
      "triage",
      "laboratory",
      "radiology",
      "pharmacy",
      "discharge",
      "icu",
      "my_hr",
    ],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_PATHOLOGIST",
    name: "Pathologist",
    allowedModules: ["laboratory", "patients", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_RADIOLOGIST",
    name: "Radiologist",
    allowedModules: ["radiology", "radiology_reports", "radiology_templates", "patients", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_PHYSIOTHERAPIST",
    name: "Physiotherapist",
    allowedModules: ["patients", "clinical", "inpatient", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_RECEPTIONIST",
    name: "Receptionist",
    allowedModules: ["patients", "appointments", "emergency", "op", "billing_op", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_FRONT_OFFICE_MANAGER",
    name: "Front Office Manager",
    allowedModules: ["patients", "appointments", "emergency", "op", "billing_op", "beds", "patient_exp", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_NURSE",
    name: "Nurse",
    allowedModules: ["patients", "inpatient", "nursing", "emergency", "triage", "clinical", "discharge", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_NURSING_SUPERVISOR",
    name: "Nursing Supervisor",
    allowedModules: ["patients", "inpatient", "nursing", "emergency", "triage", "clinical", "beds", "discharge", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_PHARMACIST",
    name: "Pharmacist",
    allowedModules: ["pharmacy", "pharmacy_dispensing", "pharmacy_rx", "pharmacy_returns", "pharmacy_medicine", "pharmacy_po", "pharmacy_grn", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_PHARMACY_MANAGER",
    name: "Pharmacy Manager",
    allowedModules: [
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
      "my_hr",
    ],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_LAB_TECHNICIAN",
    name: "Lab Technician",
    allowedModules: ["laboratory", "patients", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_RADIOLOGY_TECHNICIAN",
    name: "Radiology Technician",
    allowedModules: ["radiology", "radiology_reports", "patients", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_HR_MANAGER",
    name: "HR Manager",
    allowedModules: [
      "hr",
      "hr_employees",
      "hr_attendance",
      "hr_shifts",
      "hr_leaves",
      "hr_payroll",
      "hr_recruitment",
      "hr_performance",
      "hr_training",
      "hr_documents",
      "hr_reports",
      "hr_announcements",
      "my_hr",
    ],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_HR_EXECUTIVE",
    name: "HR Executive",
    allowedModules: ["hr", "hr_employees", "hr_attendance", "hr_shifts", "hr_leaves", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_ACCOUNTANT",
    name: "Accountant",
    allowedModules: ["accounts", "accounts_dashboard", "accounts_coa", "accounts_gl", "accounts_receipts", "accounts_payments", "accounts_ar", "accounts_ap", "accounts_cash_bank", "accounts_reports", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_FINANCE_MANAGER",
    name: "Finance Manager",
    allowedModules: [
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
      "billing",
      "my_hr",
    ],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_BILLING_EXECUTIVE",
    name: "Billing Executive",
    allowedModules: ["billing", "billing_op", "billing_ip", "billing_er", "billing_unified", "billing_revenue", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_INSURANCE_TPA_OFFICER",
    name: "Insurance / TPA Officer",
    allowedModules: ["insurance", "insurance_desk", "insurance_preauth", "insurance_claims", "insurance_queries", "insurance_emails", "insurance_settlement", "insurance_reconciliation", "insurance_masters", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_MEDICAL_RECORDS_OFFICER",
    name: "Medical Records Officer",
    allowedModules: ["patients", "clinical", "discharge", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_INVENTORY_MANAGER",
    name: "Inventory Manager",
    allowedModules: ["pharmacy_medicine", "pharmacy_suppliers", "pharmacy_po", "pharmacy_grn", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_FACILITY_MANAGER",
    name: "Facility Manager",
    allowedModules: ["beds", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_COMPLIANCE_OFFICER",
    name: "Compliance Officer",
    allowedModules: ["audit", "patients", "clinical", "my_hr"],
    status: "Active",
    isSystem: true,
  },
  {
    id: "ROLE_IT_SUPPORT",
    name: "IT Support",
    allowedModules: ["dashboard", "settings", "audit", "my_hr"],
    status: "Active",
    isSystem: true,
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
    {
      id: "U_LAB",
      username: "lab",
      password: "password123",
      roleId: "ROLE_LAB_TECHNICIAN",
      name: "Laboratory Technician",
      staffId: "LAB-001",
      status: "Active",
    },
    {
      id: "U_PHARMACY",
      username: "pharmacy",
      password: "password123",
      roleId: "ROLE_PHARMACIST",
      name: "Hospital Pharmacist",
      staffId: "PHM-001",
      status: "Active",
    },
    {
      id: "U_NURSE",
      username: "nurse",
      password: "password123",
      roleId: "ROLE_NURSE",
      name: "Staff Nurse",
      staffId: "NUR-001",
      status: "Active",
    },
    {
      id: "U_RECEPTION",
      username: "reception",
      password: "password123",
      roleId: "ROLE_RECEPTIONIST",
      name: "Front Office Receptionist",
      staffId: "REC-001",
      status: "Active",
    },
    {
      id: "U_BILLING",
      username: "billing",
      password: "password123",
      roleId: "ROLE_BILLING_EXECUTIVE",
      name: "Billing Executive",
      staffId: "BIL-001",
      status: "Active",
    },
    {
      id: "U_INSURANCE",
      username: "insurance",
      password: "password123",
      roleId: "ROLE_INSURANCE_TPA_OFFICER",
      name: "Insurance Officer",
      staffId: "INS-001",
      status: "Active",
    },
    {
      id: "U_FINANCE",
      username: "finance",
      password: "password123",
      roleId: "ROLE_ACCOUNTANT",
      name: "Accountant",
      staffId: "ACC-001",
      status: "Active",
    },
    {
      id: "U_HR",
      username: "hr",
      password: "password123",
      roleId: "ROLE_HR_MANAGER",
      name: "HR Manager",
      staffId: "HR-001",
      status: "Active",
    },
    {
      id: "U_RADIOLOGY",
      username: "radiology",
      password: "password123",
      roleId: "ROLE_RADIOLOGIST",
      name: "Radiologist",
      staffId: "RAD-001",
      status: "Active",
    },
    {
      id: "U_DOCTOR",
      username: "doctor",
      password: "password123",
      roleId: "ROLE_DOCTOR",
      name: "Dr. Vikram Seth",
      staffId: "DOC-001",
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
      if (!Array.isArray(parsed) || parsed.length === 0) {
        window.localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(INITIAL_ROLES))
        return INITIAL_ROLES
      }

      const roleMap = new Map<string, AppRole>()
      INITIAL_ROLES.forEach((r) => roleMap.set(r.id, { ...r }))

      parsed.forEach((r) => {
        if (r && r.id) {
          const base = roleMap.get(r.id)
          roleMap.set(r.id, {
            ...base,
            ...r,
            allowedModules: Array.isArray(r.allowedModules) ? r.allowedModules : (base?.allowedModules || []),
            status: r.status || base?.status || "Active",
            isSystem: r.isSystem ?? base?.isSystem ?? false,
          })
        }
      })

      const adminRole = roleMap.get("ROLE_ADMIN")
      if (adminRole) {
        adminRole.name = "System Administrator"
        adminRole.allowedModules = [...ALL_SYSTEM_MODULES, "*"]
      }

      const result = Array.from(roleMap.values())
      return result
    } catch {
      return INITIAL_ROLES
    }
  }

  static saveRoles(roles: AppRole[]): void {
    if (typeof window === "undefined") return

    try {
      window.localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles))
      window.dispatchEvent(new Event("rbac_roles_updated"))
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
      if (!Array.isArray(users) || users.length === 0) {
        window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial))
        return initial
      }

      const userMap = new Map<string, AppUser>()
      initial.forEach((u) => userMap.set(u.username.toLowerCase(), { ...u }))

      users.forEach((u) => {
        if (u && u.username) {
          const key = u.username.toLowerCase()
          const base = userMap.get(key)
          userMap.set(key, {
            ...base,
            ...u,
            roleId: u.roleId || base?.roleId || "ROLE_LAB_TECHNICIAN",
            status: u.status || base?.status || "Active",
          })
        }
      })

      return Array.from(userMap.values())
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

  static upsertRole(role: AppRole): AppRole[] {
    const roles = this.getRoles()
    const idx = roles.findIndex((r) => r.id === role.id)
    let updated: AppRole[]
    if (idx >= 0) {
      updated = [...roles]
      updated[idx] = { ...updated[idx], ...role }
    } else {
      updated = [...roles, role]
    }
    this.saveRoles(updated)
    return updated
  }

  static deleteRole(roleId: string): { success: boolean; error?: string } {
    if (roleId === "ROLE_ADMIN" || roleId === "ROLE_SUPERADMIN") {
      return { success: false, error: "System administrator roles cannot be deleted." }
    }
    const roles = this.getRoles()
    const role = roles.find((r) => r.id === roleId)
    if (!role) {
      return { success: false, error: "Role not found." }
    }
    if (role.isSystem) {
      return { success: false, error: "Built-in system role templates cannot be deleted." }
    }
    const users = this.getUsers()
    const assignedUsers = users.filter((u) => u.roleId === roleId)
    if (assignedUsers.length > 0) {
      return {
        success: false,
        error: `Cannot delete role '${role.name}': ${assignedUsers.length} staff member(s) are currently assigned to it.`,
      }
    }
    const filtered = roles.filter((r) => r.id !== roleId)
    this.saveRoles(filtered)
    return { success: true }
  }

  static cloneRole(sourceRoleId: string, newRoleId: string, newRoleName: string): AppRole {
    const roles = this.getRoles()
    const source = roles.find((r) => r.id === sourceRoleId)
    const newRole: AppRole = {
      id: newRoleId,
      name: newRoleName,
      allowedModules: source ? [...source.allowedModules] : [],
      status: "Active",
      isSystem: false,
    }
    this.upsertRole(newRole)
    return newRole
  }

}

export type PermissionAction =
  | "read"
  | "write"
  | "delete"
  | "export"
  | "view"
  | "create"
  | "edit"
  | "approve"

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
      (m) =>
        m === moduleName ||
        m.startsWith(`${moduleName}:`) ||
        m.startsWith(`${moduleName}.`),
    )
  }

  // Normalize aliases between classic and enterprise action verbs
  const aliases: string[] = [action]
  if (action === "read" || action === "view") aliases.push("read", "view")
  if (action === "write") aliases.push("write", "create", "edit")
  if (action === "create" || action === "edit") aliases.push("write", action)

  return allowedModules.some((m) =>
    aliases.some(
      (a) => m === `${moduleName}:${a}` || m === `${moduleName}.${a}`,
    ),
  )
}

export function getGrantedActionsForModule(
  allowedModules: string[],
  moduleName: string,
): PermissionAction[] {
  if (!allowedModules) return []

  if (allowedModules.includes(moduleName) || allowedModules.includes("*")) {
    return ["view", "create", "edit", "delete", "approve", "export", "read", "write"]
  }

  const actions: PermissionAction[] = []

  const hasView =
    allowedModules.includes(`${moduleName}:view`) ||
    allowedModules.includes(`${moduleName}:read`) ||
    allowedModules.includes(`${moduleName}.view`) ||
    allowedModules.includes(`${moduleName}.read`)
  if (hasView) {
    actions.push("view", "read")
  }

  const hasCreate =
    allowedModules.includes(`${moduleName}:create`) ||
    allowedModules.includes(`${moduleName}:write`) ||
    allowedModules.includes(`${moduleName}.create`) ||
    allowedModules.includes(`${moduleName}.write`)
  if (hasCreate) {
    actions.push("create")
  }

  const hasEdit =
    allowedModules.includes(`${moduleName}:edit`) ||
    allowedModules.includes(`${moduleName}:write`) ||
    allowedModules.includes(`${moduleName}.edit`) ||
    allowedModules.includes(`${moduleName}.write`)
  if (hasEdit) {
    actions.push("edit", "write")
  }

  const hasDelete =
    allowedModules.includes(`${moduleName}:delete`) ||
    allowedModules.includes(`${moduleName}.delete`)
  if (hasDelete) {
    actions.push("delete")
  }

  const hasApprove =
    allowedModules.includes(`${moduleName}:approve`) ||
    allowedModules.includes(`${moduleName}.approve`)
  if (hasApprove) {
    actions.push("approve")
  }

  const hasExport =
    allowedModules.includes(`${moduleName}:export`) ||
    allowedModules.includes(`${moduleName}.export`)
  if (hasExport) {
    actions.push("export")
  }

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

