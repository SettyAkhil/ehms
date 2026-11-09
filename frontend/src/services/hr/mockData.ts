// Comprehensive In-Memory High-End Enterprise Mock Data for HospAI HR Workspace.
// Fresh, clean slate: 0 sample records, ready for production staff entry.

import type {
  Branch,
  Department,
  Designation,
  EmployeeListItem,
  Hospital,
  TreeNode,
  Dashboard,
} from "./types"

export type Extra = {
  attendance_trend: { date: string; present: number; absent: number; leave: number; exceptions: number; late: number }[]
  department_presence: { department_id: string; department: string; scheduled: number; present: number; absent: number; not_arrived: number; leave: number }[]
  attention: { kind: string; severity: "critical" | "warning" | "info"; count: number; title: string; detail: string; section: string }[]
}

export const MOCK_HOSPITALS: Hospital[] = [
  { id: "HOSP-01", code: "APOLLO-MAIN", name: "Apollo Super Speciality Hospital" },
]

export const MOCK_BRANCHES: Branch[] = [
  {
    id: "BR-01",
    hospital_id: "HOSP-01",
    code: "HYD-MAIN",
    name: "Main Campus - Hyderabad",
    city: "Hyderabad",
    address: "Road No 1, Jubilee Hills",
  },
  {
    id: "BR-02",
    hospital_id: "HOSP-01",
    code: "SEC-CITY",
    name: "Secunderabad Clinic Center",
    city: "Secunderabad",
    address: "SD Road, Secunderabad",
  },
]

export const MOCK_DEPARTMENTS: Department[] = [
  {
    id: "DEP-01",
    code: "CARD",
    name: "Cardiology & Cath Lab",
    branch_id: "BR-01",
    parent_id: null,
    kind: "clinical",
    head_employee_id: null,
    head_name: null,
    cost_center: "CC-CARD-101",
    annual_budget: "12000000",
    status: "active",
    hms_module: "op",
    census_wards: ["Cardio Ward 1", "Cardio ICU"],
    headcount: 0,
  },
  {
    id: "DEP-02",
    code: "EMERG",
    name: "Emergency & Trauma Center",
    branch_id: "BR-01",
    parent_id: null,
    kind: "clinical",
    head_employee_id: null,
    head_name: null,
    cost_center: "CC-ER-102",
    annual_budget: "15000000",
    status: "active",
    hms_module: "er",
    census_wards: ["Red Resuscitation", "Yellow Acute", "Green Observation"],
    headcount: 0,
  },
  {
    id: "DEP-03",
    code: "ICU",
    name: "Critical Care & ICU",
    branch_id: "BR-01",
    parent_id: null,
    kind: "clinical",
    head_employee_id: null,
    head_name: null,
    cost_center: "CC-ICU-103",
    annual_budget: "18000000",
    status: "active",
    hms_module: "icu",
    census_wards: ["MICU", "SICU", "CCU", "NICU"],
    headcount: 0,
  },
  {
    id: "DEP-04",
    code: "SURG",
    name: "Operation Theatres & Surgery",
    branch_id: "BR-01",
    parent_id: null,
    kind: "clinical",
    head_employee_id: null,
    head_name: null,
    cost_center: "CC-OT-104",
    annual_budget: "22000000",
    status: "active",
    hms_module: "ot",
    census_wards: ["OT-1", "OT-2", "OT-3", "PACU"],
    headcount: 0,
  },
  {
    id: "DEP-05",
    code: "RAD",
    name: "Radiology & Imaging",
    branch_id: "BR-01",
    parent_id: null,
    kind: "diagnostic",
    head_employee_id: null,
    head_name: null,
    cost_center: "CC-RAD-105",
    annual_budget: "9500000",
    status: "active",
    hms_module: "radiology",
    census_wards: ["MRI Suite", "CT Gantry", "USG Room"],
    headcount: 0,
  },
  {
    id: "DEP-06",
    code: "LAB",
    name: "Pathology & Laboratory",
    branch_id: "BR-01",
    parent_id: null,
    kind: "diagnostic",
    head_employee_id: null,
    head_name: null,
    cost_center: "CC-LAB-106",
    annual_budget: "8500000",
    status: "active",
    hms_module: "laboratory",
    census_wards: ["Hematology", "Biochemistry", "Microbiology"],
    headcount: 0,
  },
  {
    id: "DEP-07",
    code: "PHARM",
    name: "Central Pharmacy & Dispensary",
    branch_id: "BR-01",
    parent_id: null,
    kind: "pharmacy",
    head_employee_id: null,
    head_name: null,
    cost_center: "CC-PHM-107",
    annual_budget: "35000000",
    status: "active",
    hms_module: "pharmacy",
    census_wards: ["IP Pharmacy", "OP Dispensary"],
    headcount: 0,
  },
  {
    id: "DEP-08",
    code: "HR",
    name: "Human Resources & Workforce",
    branch_id: "BR-01",
    parent_id: null,
    kind: "administrative",
    head_employee_id: null,
    head_name: null,
    cost_center: "CC-HR-108",
    annual_budget: "4500000",
    status: "active",
    hms_module: null,
    census_wards: [],
    headcount: 0,
  },
]

export const MOCK_DESIGNATIONS: Designation[] = [
  { id: "DES-01", code: "SR_CONS", title: "Senior Consultant", job_category: "doctor", grade: "L1-A", is_clinical: true, requires_registration: true, headcount: 0 },
  { id: "DES-02", code: "CONS", title: "Consultant Physician", job_category: "doctor", grade: "L1-B", is_clinical: true, requires_registration: true, headcount: 0 },
  { id: "DES-03", code: "REG", title: "Registrar / Resident Doctor", job_category: "doctor", grade: "L2-A", is_clinical: true, requires_registration: true, headcount: 0 },
  { id: "DES-04", code: "NURSE_SUP", title: "Nursing Supervisor", job_category: "nurse", grade: "N-3", is_clinical: true, requires_registration: true, headcount: 0 },
  { id: "DES-05", code: "STAFF_NURSE", title: "Senior Staff Nurse", job_category: "nurse", grade: "N-2", is_clinical: true, requires_registration: true, headcount: 0 },
  { id: "DES-06", code: "RAD_TECH", title: "Radiology Technologist", job_category: "radiologist", grade: "T-2", is_clinical: true, requires_registration: true, headcount: 0 },
  { id: "DES-07", code: "LAB_TECH", title: "Medical Lab Technologist", job_category: "lab_technician", grade: "T-2", is_clinical: true, requires_registration: true, headcount: 0 },
  { id: "DES-08", code: "CHIEF_PHARM", title: "Chief Pharmacist", job_category: "pharmacist", grade: "P-3", is_clinical: false, requires_registration: true, headcount: 0 },
  { id: "DES-09", code: "HR_MGR", title: "HR Manager", job_category: "administration", grade: "M-2", is_clinical: false, requires_registration: false, headcount: 0 },
]

// Fresh, empty staff database ready for real hospital personnel
export const MOCK_EMPLOYEES: EmployeeListItem[] = []

export const MOCK_DASHBOARD: Dashboard & Extra = {
  as_of: new Date().toISOString(),
  employees: {
    total: 0,
    active: 0,
    inactive: 0,
    by_status: {},
    by_category: {},
    by_branch: [],
    by_department: [],
  },
  attendance_today: {
    total: 0,
    in: 0,
    out: 0,
    not_arrived: 0,
    unmapped_punches: 0,
    devices: {
      online: 0,
      offline: 0,
      total: 0,
    },
    last_sync_at: null,
  },
  credentials: {
    expiring: [],
    pending_verification: 0,
  },
  recent_activity: [],
  workforce: {
    on_leave_today: 0,
    pending_leave: 0,
    pending_approvals: 0,
    open_exceptions: 0,
    open_vacancies: 0,
    candidates_in_pipeline: 0,
    training_gaps: 0,
    certificates_expiring_60d: 0,
    last_payroll: null,
  },
  attendance_trend: [],
  department_presence: [],
  attention: [],
}

export const MOCK_SHIFTS = [
  { id: "SH-01", hospital_id: "HOSP-01", name: "Morning Clinical Shift", code: "MORN", start_time: "07:00", end_time: "15:00", duration_hours: 8, is_active: true },
  { id: "SH-02", hospital_id: "HOSP-01", name: "Evening Clinical Shift", code: "EVE", start_time: "15:00", end_time: "23:00", duration_hours: 8, is_active: true },
  { id: "SH-03", hospital_id: "HOSP-01", name: "Night Emergency Shift", code: "NIGHT", start_time: "23:00", end_time: "07:00", duration_hours: 8, is_active: true },
  { id: "SH-04", hospital_id: "HOSP-01", name: "General Administration", code: "GEN", start_time: "09:00", end_time: "17:30", duration_hours: 8.5, is_active: true },
]

export const MOCK_LEAVES: any[] = []
export const MOCK_APPROVALS: any[] = []
export const MOCK_PAYROLL: any[] = []
export const MOCK_RECRUITMENT: any[] = []
export const MOCK_TRAINING: any[] = []
export const MOCK_ANNOUNCEMENTS: any[] = []

export function handleHrMockDispatch(method: string, path: string, body?: any, query?: any): any {
  const p = (path || "").toLowerCase()

  if (p.includes("/session")) {
    return {
      user: {
        user_type: "admin",
        permissions: [
          "employees.profile.write",
          "hr.departments.write",
          "hr.attendance.write",
          "hr.shifts.write",
          "hr.leaves.write",
          "hr.payroll.write",
          "hr.recruitment.write",
          "hr.training.write",
          "hr.performance.write",
          "hr.grievances.manage",
          "hr.reports.read",
        ],
      },
    }
  }

  if (p.includes("/hospitals")) return MOCK_HOSPITALS
  if (p.includes("/branches")) return MOCK_BRANCHES
  if (p.includes("/departments")) return MOCK_DEPARTMENTS
  if (p.includes("/designations")) return MOCK_DESIGNATIONS

  if (p.includes("/hr/dashboard") || p.includes("/dashboard")) {
    const total = MOCK_EMPLOYEES.length
    const active = MOCK_EMPLOYEES.filter((e) => e.status === "active").length
    const inactive = total - active
    const byCategory: Record<string, number> = {}
    MOCK_EMPLOYEES.forEach((e) => {
      byCategory[e.employee_category] = (byCategory[e.employee_category] || 0) + 1
    })
    return {
      ...MOCK_DASHBOARD,
      as_of: new Date().toISOString(),
      employees: {
        total,
        active,
        inactive,
        by_status: { active, inactive },
        by_category: byCategory,
        by_branch: [],
        by_department: [],
      },
    }
  }

  if (p.includes("/facets")) {
    const byCategory: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    MOCK_EMPLOYEES.forEach((e) => {
      byCategory[e.employee_category] = (byCategory[e.employee_category] || 0) + 1
      byStatus[e.status] = (byStatus[e.status] || 0) + 1
    })
    return {
      employee_category: byCategory,
      status: byStatus,
    }
  }

  if (p.includes("/employment") || p.includes("/history") || p.includes("/audit") || p.includes("/notes")) {
    return []
  }

  if (p.includes("/attendance/devices") || p.includes("/devices")) {
    return []
  }

  if (p.includes("/attendance/punches") || p.includes("/punches")) {
    return { items: [], total: 0, page: 1, page_size: 50 }
  }

  if (method === "POST" && (p.includes("/hr/employees") || p.includes("/employees")) && !p.includes("/import")) {
    const b = (body as any) || {}
    const newId = `EMP-${100 + MOCK_EMPLOYEES.length + 1}`
    const newEmp: EmployeeListItem = {
      id: newId,
      employee_code: b.employee_code || `EMP-${100 + MOCK_EMPLOYEES.length + 1}`,
      full_name: [b.first_name, b.middle_name, b.last_name].filter(Boolean).join(" ") || b.full_name || "New Staff Member",
      employee_category: b.employee_category || "doctor",
      employment_type: b.employment_type || "permanent",
      status: "active",
      designation: b.designation_id || "Staff",
      department: b.department_id || "General",
      branch: b.branch_id || "Main Campus - Hyderabad",
      phone: b.phone || "",
      joining_date: b.joining_date || new Date().toISOString().split("T")[0],
      biometric_mapped: false,
    }
    MOCK_EMPLOYEES.unshift(newEmp)
    return { ...newEmp, credentials: [] }
  }

  if (method === "DELETE" && p.includes("/employees/")) {
    const id = p.split("/").pop()
    const idx = MOCK_EMPLOYEES.findIndex((e) => e.id === id)
    if (idx >= 0) MOCK_EMPLOYEES.splice(idx, 1)
    return { ok: true }
  }

  if (p.match(/\/employees\/[^\/]+$/)) {
    const parts = p.split("/")
    const empId = parts[parts.length - 1]
    const found = MOCK_EMPLOYEES.find((e) => e.id === empId || e.employee_code.toLowerCase() === empId.toLowerCase())
    if (found) {
      return {
        ...found,
        gender: "male",
        email: `${found.employee_code.toLowerCase()}@hospital.org`,
        date_of_birth: "1990-01-01",
        blood_group: "O+",
        pan_number: "",
        aadhaar_last4: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        address: "",
        base_salary: 0,
        statutory: { pf_opt_out: false, esi_eligible: false, pt_applicable: true },
        credentials: [],
      }
    }
  }

  if (p.includes("/hr/employees") || p.includes("/employees")) {
    const search = (query?.search || "").toLowerCase()
    let items = MOCK_EMPLOYEES
    if (search) {
      items = items.filter(
        (e) =>
          e.full_name.toLowerCase().includes(search) ||
          e.employee_code.toLowerCase().includes(search) ||
          (e.department && e.department.toLowerCase().includes(search))
      )
    }
    return { items, total: items.length, page: 1, page_size: 50 }
  }

  if (p.includes("/attendance/live")) {
    return {
      date: new Date().toISOString().split("T")[0],
      counts: { in: 0, out: 0, not_arrived: 0, total: 0, unmapped_punches: 0 },
      rows: [],
      departments: [],
      staff: [],
      last_sync_at: new Date().toISOString(),
    }
  }

  if (p.includes("/workforce/on-duty")) {
    return {
      departments: [],
      staff: [],
    }
  }

  if (p.includes("/workforce/rosters")) {
    return []
  }

  if (p.includes("/workforce/assignments")) {
    return []
  }

  if (p.includes("/workforce/requirements")) {
    return []
  }

  if (p.includes("/workforce/allocations")) {
    return []
  }

  if (p.includes("/recruitment/applications")) {
    return []
  }

  if (p.includes("/recruitment/vacancies") || p.includes("/vacancies")) {
    return []
  }

  if (p.includes("/attendance/daily") || p.includes("/attendance")) {
    return {
      items: [],
      total: 0,
      page: 1,
      page_size: 50,
      summary: { present: 0, absent: 0, leave: 0, late: 0 },
    }
  }

  if (p.includes("/workforce/shifts") || p.includes("/shifts")) {
    return MOCK_SHIFTS
  }

  if (p.includes("/workforce/coverage") || p.includes("/coverage")) {
    return {
      rows: MOCK_DEPARTMENTS.map((d) => ({
        department: d.name,
        shift: "General",
        category: "nurse",
        required: 0,
        assigned: 0,
        allocated: 0,
        actual: 0,
        shortage: 0,
        patients: 0,
        staff: [],
      })),
      total_shortage: 0,
      census_error: null,
    }
  }

  if (p.includes("/leaves")) {
    return { items: MOCK_LEAVES, total: MOCK_LEAVES.length, page: 1, page_size: 50 }
  }

  if (p.includes("/approvals") || p.includes("/workflows")) {
    return MOCK_APPROVALS
  }

  if (p.includes("/payroll/runs") || p.includes("/payroll")) {
    return { runs: MOCK_PAYROLL, current: null }
  }

  if (p.includes("/recruitment/applications") || p.includes("/applications")) {
    return []
  }

  if (p.includes("/recruitment/vacancies") || p.includes("/vacancies")) {
    return []
  }

  if (p.includes("/recruitment")) {
    return []
  }

  if (p.includes("/training/matrix")) {
    return {
      programs: [],
      rows: [],
      gaps: 0,
    }
  }

  if (p.includes("/training")) {
    return MOCK_TRAINING
  }

  if (p.includes("/announcements")) {
    return MOCK_ANNOUNCEMENTS
  }

  if (p.includes("/reports")) {
    return [
      { id: "REP-01", name: "Monthly Muster Roll & Attendance Register (Form 25)", category: "Statutory" },
      { id: "REP-02", name: "Provident Fund ECR Summary Statement", category: "Payroll" },
      { id: "REP-03", name: "ESIC Contribution & Return Report", category: "Payroll" },
      { id: "REP-04", name: "NABH Clinical Staffing Ratio Compliance", category: "Audit" },
    ]
  }

  if (method !== "GET") {
    return { status: "success", ok: true, message: "Operation completed successfully" }
  }

  return { ok: true, items: [] }
}
