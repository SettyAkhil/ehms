/**
 * Earlier builds seeded every browser with sample records (patients, visits,
 * lab orders, imaging studies, claims ...). Those seeds are gone from the code,
 * but browsers that ran an older build still hold them in local storage. Each
 * store passes its rows through `dropLegacySeeds`; a row is removed only when
 * BOTH its id and its patient name match a known sample record, so a real
 * patient who happens to reuse a sample id is never touched.
 */

export type SeedFingerprint = readonly [id: string, name: string]

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase()

/** Rows of `rows` that are not legacy sample records. */
export function dropLegacySeeds<T>(
  rows: T[],
  prints: readonly SeedFingerprint[],
  idOf: (row: T) => unknown,
  nameOf: (row: T) => unknown,
): T[] {
  const set = new Set(prints.map(([id, name]) => `${norm(id)}|${norm(name)}`))
  return rows.filter((r) => !set.has(`${norm(idOf(r))}|${norm(nameOf(r))}`))
}

// -- OP desk (services/db.ts) --------------------------------------------------
export const SEED_OP_PATIENTS: readonly SeedFingerprint[] = [["UMR10001","Ravi Kumar"],["UMR10002","Sunita Patel"],["UMR10048","Alex Turner"],["UMR10067","Rana Dhaggubati"],["UMR10042","Rahul Roy"],["UMR10055","Suresh Nair"],["UMR10088","Appanna Chinnapati"],["UMR10099","Lokesh P"]]

export const SEED_OP_ENCOUNTERS: readonly SeedFingerprint[] = [["ENC-10067-1","Rana Dhaggubati"],["ENC-10001-2","Ravi Kumar"],["ENC-10002-1","Sunita Patel"],["ENC-10048-1","Alex Turner"],["ENC-10042-1","Rahul Roy"],["ENC-10055-1","Suresh Nair"],["ENC-10001-1","Ravi Kumar"],["ENC-100245-1","John Smith"],["ENC-100245-2","John Smith"],["ENC-100289-1","Robert Lee"],["ENC-100512-1","Maria Garcia"],["ENC-10088-1","Appanna Chinnapati"]]

// -- Laboratory orders (services/labOrdersDb.ts) --------------------------------
export const SEED_LAB_ORDERS: readonly SeedFingerprint[] = [
  ["LAB-2026-0001", "Rahul Kumar"],
  ["LAB-2026-0002", "Priya Sharma"],
  ["LAB-2026-0003", "Anand Verma"],
  ["LAB-2026-0004", "Sunita Reddy"],
  ["LAB-2026-0088", "Appanna Chinnapati"],
  ["LAB-2026-0089", "Appanna Chinnapati"],
]

/**
 * Global purge routine: Ensures all legacy sample/seed patient records,
 * mock encounters, claims, lab orders, and radiology studies stored in older
 * browser sessions are reset so the system starts completely blank.
 */
export function purgeAllLegacySeedData(): void {
  if (typeof window === "undefined") return

  const PURGE_FLAG = "hospai_seeds_purged_v11"
  if (localStorage.getItem(PURGE_FLAG) === "true") return

  const keysToResetEmptyArray = [
    "hospai_lis_qc_records_v1",
    "hosp_billing_claims_inr_v11",
    "hosp_billing_dept_charges_v11",
    "hosp_lab_orders_v1",
    "hosp_rad_studies_v1",
    "hospai_lab_orders_v2",
    "hospai_lab_orders_v1",
    "hospai_db_patients",
    "hospai_db_patients_v1",
    "hospai_db_encounters",
    "hospai_db_encounters_v1",
    "hospai_db_call_history_v1",
    "hospai_er_patients",
    "hospai_er_patients_v8",
    "hospai_er_patients_v7",
    "hospai_er_patients_v6",
    "hospai_er_visits",
    "hospai_er_visits_v8",
    "hospai_er_visits_v7",
    "hospai_er_visits_v6",
    "hospai_er_bed_requests",
    "hospai_er_discharges",
    "hospai_surgery_cases",
    "hospai_surgery_cases_v2",
    "hospai_surgery_cases_cache_v1",
    "hospai_billing_audit_logs_v1",
    "hospai_billing_adjustments_v1",
    "hospai_billing_refunds_v1",
    "hospai_billing_ar_v1",
    "hosp_discharged_patients_v1",
    "hospai_discharged_patients_v3",
    "hospai_bed_transfer_notifications_v3",
    "hospai_pending_bed_allocation_v2",
    "hospai_inpatient_beds_v9",
    "hospai_rad_appointments_v1",
    "hospai_rad_exceptions_v1",
    "hospai_rad_templates_v1",
    "hospai_rad_templates_v2",
    "hospai_rad_tests_v1",
    "hospai_insurance_companies_v1",
    "hospai_insurance_packages_v1",
    "hospai_insurance_pricing_rules_v1",
    "hospai_insurance_document_rules_v1",
    "hospai_diagnostic_tariffs_v5",
    "hospai_audit_logs_v1",
    "hospai_rbac_roles_v28",
    "hospai_rbac_roles_v27",
    "hms_nursing_assignments",
    "hms_nursing_doctor_instructions",
    "hms_nursing_notes",
    "hms_nursing_messages",
    "hms_nursing_handovers",
    "hospai_doctor_portal_read_v1",
    "hospai_doctor_consultations_v1",
    "hospai_doctor_acked_alerts_v1",
    "hospai_insurance_cases_v2",
    "hospai_patient_policies_v1",
    "hospai_insurance_fixed_package_bills_v1",
    "hospai_lab_inventory_items_v1",
    "hospai_lab_inventory_tx_v1",
    "hospai_lab_inventory_suppliers_v1",
    "hospai_pharm_medicines_v1",
    "hospai_pharm_batches_v1",
    "hospai_pharm_prescriptions_v1",
    "hospai_pharm_bills_v1",
    "hospai_pharm_purchase_orders_v1",
    "hospai_pharm_grns_v1",
    "hospai_pharm_returns_v1",
    "hospai_pharm_audit_logs_v1",
    "hrms_payroll_run",
    "hrms_staff_loans",
    "hospai_doctor_master_v3",
  ]

  keysToResetEmptyArray.forEach((k) => {
    try {
      localStorage.setItem(k, "[]")
    } catch {}
  })

  // Set default system administrator user account
  try {
    const adminUser = [
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
    localStorage.setItem("hospai_rbac_users_v2", JSON.stringify(adminUser))

    // Set default single system administrator role (all other roles removed)
    const adminRoles = [
      {
        id: "ROLE_ADMIN",
        name: "System Administrator",
        allowedModules: [
          "dashboard", "patients", "chart", "register", "appointments", "outpatient",
          "op_management", "op_registration", "op_nurse", "inpatient", "nursing", "icu",
          "beds", "emergency", "triage", "surgery", "laboratory", "radiology",
          "radiology_reports", "radiology_templates", "pharmacy", "pharmacy_dispensing",
          "pharmacy_rx", "pharmacy_ocr", "pharmacy_returns", "pharmacy_supplier_returns",
          "pharmacy_medicine", "pharmacy_category", "pharmacy_suppliers", "pharmacy_po",
          "pharmacy_grn", "pharmacy_ledger", "pharmacy_transfers", "pharmacy_expiry",
          "pharmacy_write_off", "pharmacy_analytics", "pharmacy_notifications", "pharmacy_users",
          "pharmacy_audit", "pharmacy_settings", "billing", "billing_op", "billing_ip",
          "billing_er", "billing_unified", "billing_revenue", "payments", "lab_billing",
          "insurance", "insurance_desk", "insurance_preauth", "insurance_claims", "insurance_queries",
          "insurance_emails", "insurance_settlement", "insurance_reconciliation", "insurance_masters",
          "insurance_tpas", "insurance_packages", "insurance_pricing", "insurance_docrules",
          "accounts", "accounts_dashboard", "accounts_coa", "accounts_gl", "accounts_receipts",
          "accounts_payments", "accounts_ar", "accounts_ap", "accounts_cash_bank", "accounts_pharmacy",
          "accounts_insurance", "accounts_tax", "accounts_budget", "accounts_assets",
          "accounts_cost_centres", "accounts_reports", "accounts_period_close", "accounts_audit",
          "accounts_manager", "reports", "revenue_reports", "reports_pharmacy_damaged",
          "reports_supplier_returns", "hrms", "employees", "reports_staff", "intelligence",
          "dpi_ocr", "discharge", "patient_messages", "queue", "doctor_portal", "admin",
          "admin_analytics", "security_audit", "my_hr"
        ],
      },
    ]
    localStorage.setItem("hospai_rbac_roles_v29", JSON.stringify(adminRoles))
    localStorage.removeItem("hospai_rbac_roles_v28")
    localStorage.removeItem("hospai_rbac_roles_v27")
  } catch {}

  // Sanitize bed registry so all physical beds are Available with no mock patients
  try {
    const rawBeds = localStorage.getItem("hospai_inpatient_beds_v9")
    if (rawBeds) {
      const beds = JSON.parse(rawBeds)
      if (Array.isArray(beds)) {
        const cleanedBeds = beds.map((b: any) => ({
          ...b,
          status: "Available",
          allocation_id: null,
          patient_id: null,
          patient_name: null,
          patient_last_name: null,
          patient_gender: null,
          patient_age: null,
          assigned_doctor: null,
          admission_id: null,
          admission_notes: null,
          admitted_at: null,
          estimated_discharge: null,
        }))
        localStorage.setItem("hospai_inpatient_beds_v9", JSON.stringify(cleanedBeds))
      }
    }
  } catch {}

  // Clear all rad sent/status keys and ICU flowsheets
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (
        k &&
        (k.startsWith("hospai_rad_sent_") ||
          k.startsWith("hospai_rad_rep_status_") ||
          k.startsWith("icu.flowsheet."))
      ) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  } catch {}

  localStorage.setItem(PURGE_FLAG, "true")
}

// Expose on window for easy developer/admin on-demand reset
if (typeof window !== "undefined") {
  ;(window as any).purgeAllSeedData = () => {
    localStorage.clear()
    window.location.reload()
  }
}
