// Comprehensive In-Memory High-End Enterprise Mock Data for HospAI HR Workspace.
// Ensures 100% offline uptime and zero-latency rendering across all 16 HR modules.

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
    head_employee_id: "EMP-101",
    head_name: "Dr. Rajesh Sharma",
    cost_center: "CC-CARD-101",
    annual_budget: "12000000",
    status: "active",
    hms_module: "op",
    census_wards: ["Cardio Ward 1", "Cardio ICU"],
    headcount: 24,
  },
  {
    id: "DEP-02",
    code: "EMERG",
    name: "Emergency & Trauma Center",
    branch_id: "BR-01",
    parent_id: null,
    kind: "clinical",
    head_employee_id: "EMP-102",
    head_name: "Dr. Priya Nair",
    cost_center: "CC-ER-102",
    annual_budget: "15000000",
    status: "active",
    hms_module: "er",
    census_wards: ["Red Resuscitation", "Yellow Acute", "Green Observation"],
    headcount: 32,
  },
  {
    id: "DEP-03",
    code: "ICU",
    name: "Critical Care & ICU",
    branch_id: "BR-01",
    parent_id: null,
    kind: "clinical",
    head_employee_id: "EMP-103",
    head_name: "Dr. Arvind Swaminathan",
    cost_center: "CC-ICU-103",
    annual_budget: "18000000",
    status: "active",
    hms_module: "icu",
    census_wards: ["MICU", "SICU", "CCU", "NICU"],
    headcount: 28,
  },
  {
    id: "DEP-04",
    code: "SURG",
    name: "Operation Theatres & Surgery",
    branch_id: "BR-01",
    parent_id: null,
    kind: "clinical",
    head_employee_id: "EMP-104",
    head_name: "Dr. Vikram Seth",
    cost_center: "CC-OT-104",
    annual_budget: "22000000",
    status: "active",
    hms_module: "ot",
    census_wards: ["OT-1", "OT-2", "OT-3", "PACU"],
    headcount: 26,
  },
  {
    id: "DEP-05",
    code: "RAD",
    name: "Radiology & Imaging",
    branch_id: "BR-01",
    parent_id: null,
    kind: "diagnostic",
    head_employee_id: "EMP-105",
    head_name: "Dr. Anita Desai",
    cost_center: "CC-RAD-105",
    annual_budget: "9500000",
    status: "active",
    hms_module: "radiology",
    census_wards: ["MRI Suite", "CT Gantry", "USG Room"],
    headcount: 14,
  },
  {
    id: "DEP-06",
    code: "LAB",
    name: "Pathology & Laboratory",
    branch_id: "BR-01",
    parent_id: null,
    kind: "diagnostic",
    head_employee_id: "EMP-106",
    head_name: "Dr. Suresh Menon",
    cost_center: "CC-LAB-106",
    annual_budget: "8500000",
    status: "active",
    hms_module: "laboratory",
    census_wards: ["Hematology", "Biochemistry", "Microbiology"],
    headcount: 16,
  },
  {
    id: "DEP-07",
    code: "PHARM",
    name: "Central Pharmacy & Dispensary",
    branch_id: "BR-01",
    parent_id: null,
    kind: "pharmacy",
    head_employee_id: "EMP-107",
    head_name: "Sunita Reddy",
    cost_center: "CC-PHM-107",
    annual_budget: "35000000",
    status: "active",
    hms_module: "pharmacy",
    census_wards: ["IP Pharmacy", "OP Dispensary"],
    headcount: 18,
  },
  {
    id: "DEP-08",
    code: "HR",
    name: "Human Resources & Workforce",
    branch_id: "BR-01",
    parent_id: null,
    kind: "administrative",
    head_employee_id: "EMP-108",
    head_name: "Meenakshi Sundaram",
    cost_center: "CC-HR-108",
    annual_budget: "4500000",
    status: "active",
    hms_module: null,
    census_wards: [],
    headcount: 8,
  },
]

export const MOCK_DESIGNATIONS: Designation[] = [
  { id: "DES-01", code: "SR_CONS", title: "Senior Consultant", job_category: "doctor", grade: "L1-A", is_clinical: true, requires_registration: true, headcount: 12 },
  { id: "DES-02", code: "CONS", title: "Consultant Physician", job_category: "doctor", grade: "L1-B", is_clinical: true, requires_registration: true, headcount: 18 },
  { id: "DES-03", code: "REG", title: "Registrar / Resident Doctor", job_category: "doctor", grade: "L2-A", is_clinical: true, requires_registration: true, headcount: 22 },
  { id: "DES-04", code: "NURSE_SUP", title: "Nursing Supervisor", job_category: "nurse", grade: "N-3", is_clinical: true, requires_registration: true, headcount: 8 },
  { id: "DES-05", code: "STAFF_NURSE", title: "Senior Staff Nurse", job_category: "nurse", grade: "N-2", is_clinical: true, requires_registration: true, headcount: 45 },
  { id: "DES-06", code: "RAD_TECH", title: "Radiology Technologist", job_category: "radiologist", grade: "T-2", is_clinical: true, requires_registration: true, headcount: 10 },
  { id: "DES-07", code: "LAB_TECH", title: "Medical Lab Technologist", job_category: "lab_technician", grade: "T-2", is_clinical: true, requires_registration: true, headcount: 12 },
  { id: "DES-08", code: "CHIEF_PHARM", title: "Chief Pharmacist", job_category: "pharmacist", grade: "P-3", is_clinical: false, requires_registration: true, headcount: 4 },
  { id: "DES-09", code: "HR_MGR", title: "HR Manager", job_category: "administration", grade: "M-2", is_clinical: false, requires_registration: false, headcount: 2 },
]

export const MOCK_EMPLOYEES: EmployeeListItem[] = [
  {
    id: "EMP-101",
    employee_code: "DOC-101",
    full_name: "Dr. Rajesh Sharma",
    employee_category: "doctor",
    employment_type: "permanent",
    status: "active",
    designation: "Senior Consultant",
    department: "Cardiology & Cath Lab",
    branch: "Main Campus - Hyderabad",
    phone: "+91 98765 43210",
    joining_date: "2021-03-01",
    biometric_mapped: true,
  },
  {
    id: "EMP-102",
    employee_code: "DOC-102",
    full_name: "Dr. Priya Nair",
    employee_category: "doctor",
    employment_type: "permanent",
    status: "active",
    designation: "Senior Consultant",
    department: "Emergency & Trauma Center",
    branch: "Main Campus - Hyderabad",
    phone: "+91 98450 11223",
    joining_date: "2020-07-15",
    biometric_mapped: true,
  },
  {
    id: "EMP-103",
    employee_code: "DOC-103",
    full_name: "Dr. Arvind Swaminathan",
    employee_category: "doctor",
    employment_type: "permanent",
    status: "active",
    designation: "Senior Consultant",
    department: "Critical Care & ICU",
    branch: "Main Campus - Hyderabad",
    phone: "+91 98111 22334",
    joining_date: "2019-11-10",
    biometric_mapped: true,
  },
  {
    id: "EMP-104",
    employee_code: "DOC-104",
    full_name: "Dr. Vikram Seth",
    employee_category: "doctor",
    employment_type: "permanent",
    status: "active",
    designation: "Consultant Physician",
    department: "Operation Theatres & Surgery",
    branch: "Main Campus - Hyderabad",
    phone: "+91 99887 76655",
    joining_date: "2022-01-10",
    biometric_mapped: true,
  },
  {
    id: "EMP-105",
    employee_code: "DOC-105",
    full_name: "Dr. Anita Desai",
    employee_category: "radiologist",
    employment_type: "permanent",
    status: "active",
    designation: "Senior Consultant",
    department: "Radiology & Imaging",
    branch: "Main Campus - Hyderabad",
    phone: "+91 98777 66554",
    joining_date: "2021-08-01",
    biometric_mapped: true,
  },
  {
    id: "EMP-106",
    employee_code: "NUR-201",
    full_name: "Mary Fernandez",
    employee_category: "nurse",
    employment_type: "permanent",
    status: "active",
    designation: "Nursing Supervisor",
    department: "Critical Care & ICU",
    branch: "Main Campus - Hyderabad",
    phone: "+91 97654 32109",
    joining_date: "2018-05-12",
    biometric_mapped: true,
  },
  {
    id: "EMP-107",
    employee_code: "NUR-202",
    full_name: "Kavitha Raman",
    employee_category: "nurse",
    employment_type: "permanent",
    status: "active",
    designation: "Senior Staff Nurse",
    department: "Emergency & Trauma Center",
    branch: "Main Campus - Hyderabad",
    phone: "+91 97111 88990",
    joining_date: "2022-04-18",
    biometric_mapped: true,
  },
  {
    id: "EMP-108",
    employee_code: "PHM-301",
    full_name: "Sunita Reddy",
    employee_category: "pharmacist",
    employment_type: "permanent",
    status: "active",
    designation: "Chief Pharmacist",
    department: "Central Pharmacy & Dispensary",
    branch: "Main Campus - Hyderabad",
    phone: "+91 99000 11223",
    joining_date: "2020-02-15",
    biometric_mapped: true,
  },
  {
    id: "EMP-109",
    employee_code: "LAB-401",
    full_name: "Ramesh Babu",
    employee_category: "lab_technician",
    employment_type: "permanent",
    status: "active",
    designation: "Medical Lab Technologist",
    department: "Pathology & Laboratory",
    branch: "Main Campus - Hyderabad",
    phone: "+91 98222 33445",
    joining_date: "2021-10-01",
    biometric_mapped: true,
  },
  {
    id: "EMP-110",
    employee_code: "HR-501",
    full_name: "Meenakshi Sundaram",
    employee_category: "administration",
    employment_type: "permanent",
    status: "active",
    designation: "HR Manager",
    department: "Human Resources & Workforce",
    branch: "Main Campus - Hyderabad",
    phone: "+91 98444 55667",
    joining_date: "2019-03-15",
    biometric_mapped: true,
  },
]

export const MOCK_DASHBOARD: Dashboard & Extra = {
  as_of: new Date().toISOString(),
  employees: {
    total: 166,
    active: 158,
    inactive: 8,
    by_status: { active: 158, probation: 5, notice_period: 3 },
    by_category: {
      doctor: 32,
      consultant: 12,
      nurse: 53,
      radiologist: 14,
      lab_technician: 16,
      pharmacist: 18,
      ot_technician: 8,
      icu_technician: 10,
      emergency_staff: 12,
      front_office: 8,
      billing: 10,
      administration: 15,
      support: 18,
    },
    by_branch: [
      { branch: "Main Campus - Hyderabad", count: 124 },
      { branch: "Secunderabad Clinic Center", count: 42 },
    ],
    by_department: [
      { department_id: "DEP-01", department: "Cardiology & Cath Lab", count: 24 },
      { department_id: "DEP-02", department: "Emergency & Trauma Center", count: 32 },
      { department_id: "DEP-03", department: "Critical Care & ICU", count: 28 },
      { department_id: "DEP-04", department: "Operation Theatres & Surgery", count: 26 },
      { department_id: "DEP-05", department: "Radiology & Imaging", count: 14 },
      { department_id: "DEP-06", department: "Pathology & Laboratory", count: 16 },
      { department_id: "DEP-07", department: "Central Pharmacy & Dispensary", count: 18 },
      { department_id: "DEP-08", department: "Human Resources & Workforce", count: 8 },
    ],
  },
  attendance_today: {
    total: 166,
    in: 142,
    out: 12,
    not_arrived: 4,
    unmapped_punches: 0,
    devices: {
      online: 8,
      offline: 0,
      total: 8,
    },
    last_sync_at: new Date().toISOString(),
  },
  credentials: {
    expiring: [
      {
        employee_id: "EMP-101",
        employee_code: "DOC-101",
        employee_name: "Dr. Rajesh Sharma",
        credential_type: "State Medical Council Registration",
        number: "MCI-44012",
        expires_on: "2026-11-25",
        days_left: 16,
      },
      {
        employee_id: "EMP-105",
        employee_code: "DOC-105",
        employee_name: "Dr. Anita Desai",
        credential_type: "Atomic Energy Regulatory Board (AERB) License",
        number: "AERB-RAD-9921",
        expires_on: "2026-11-30",
        days_left: 21,
      },
      {
        employee_id: "EMP-103",
        employee_code: "DOC-103",
        employee_name: "Dr. Arvind Swaminathan",
        credential_type: "NABH Clinical Assessor Certification",
        number: "NABH-MED-108",
        expires_on: "2026-12-15",
        days_left: 36,
      },
    ],
    pending_verification: 1,
  },
  recent_activity: [
    {
      employee_id: "EMP-102",
      employee_name: "Dr. Priya Nair",
      event_type: "leave_approved",
      summary: "Casual Leave approved for 12-13 Nov",
      occurred_at: new Date(Date.now() - 3600000).toISOString(),
      actor: "Medical Superintendent",
    },
    {
      employee_id: "EMP-106",
      employee_name: "Mary Fernandez",
      event_type: "shift_rostered",
      summary: "Assigned to ICU Night Shift",
      occurred_at: new Date(Date.now() - 7200000).toISOString(),
      actor: "Nursing Supervisor",
    },
    {
      employee_id: "EMP-107",
      employee_name: "K. Venkatesh",
      event_type: "check_in",
      summary: "Morning Shift Biometric Punch recorded",
      occurred_at: new Date(Date.now() - 10800000).toISOString(),
      actor: null,
    },
    {
      employee_id: "EMP-101",
      employee_name: "Dr. Rajesh Sharma",
      event_type: "ot_scheduled",
      summary: "Cardiac Catheterization slot booked for OT-2",
      occurred_at: new Date(Date.now() - 14400000).toISOString(),
      actor: "Dr. Rajesh Sharma",
    },
  ],
  workforce: {
    on_leave_today: 6,
    pending_leave: 3,
    pending_approvals: 4,
    open_exceptions: 1,
    open_vacancies: 7,
    candidates_in_pipeline: 42,
    training_gaps: 2,
    certificates_expiring_60d: 2,
    last_payroll: {
      period: "October 2026",
      status: "completed",
      employees: 158,
      net: "7420000",
    },
  },
  attendance_trend: [
    { date: "2026-11-03", present: 148, absent: 4, leave: 6, exceptions: 2, late: 6 },
    { date: "2026-11-04", present: 150, absent: 3, leave: 5, exceptions: 1, late: 4 },
    { date: "2026-11-05", present: 149, absent: 5, leave: 4, exceptions: 3, late: 7 },
    { date: "2026-11-06", present: 152, absent: 2, leave: 4, exceptions: 0, late: 3 },
    { date: "2026-11-07", present: 146, absent: 6, leave: 6, exceptions: 2, late: 8 },
    { date: "2026-11-08", present: 144, absent: 4, leave: 10, exceptions: 1, late: 5 },
    { date: "2026-11-09", present: 154, absent: 2, leave: 2, exceptions: 1, late: 3 },
  ],
  department_presence: [
    { department_id: "DEP-01", department: "Cardiology", scheduled: 24, present: 23, absent: 0, not_arrived: 0, leave: 1 },
    { department_id: "DEP-02", department: "Emergency", scheduled: 32, present: 31, absent: 0, not_arrived: 1, leave: 0 },
    { department_id: "DEP-03", department: "ICU & Critical Care", scheduled: 28, present: 26, absent: 1, not_arrived: 0, leave: 1 },
    { department_id: "DEP-04", department: "Operation Theatres", scheduled: 26, present: 25, absent: 0, not_arrived: 0, leave: 1 },
    { department_id: "DEP-05", department: "Radiology", scheduled: 14, present: 13, absent: 0, not_arrived: 0, leave: 1 },
    { department_id: "DEP-06", department: "Laboratory", scheduled: 16, present: 15, absent: 0, not_arrived: 1, leave: 0 },
    { department_id: "DEP-07", department: "Pharmacy", scheduled: 18, present: 17, absent: 1, not_arrived: 0, leave: 0 },
    { department_id: "DEP-08", department: "Human Resources", scheduled: 8, present: 8, absent: 0, not_arrived: 0, leave: 0 },
  ],
  attention: [
    {
      kind: "credential_expiry",
      severity: "critical" as const,
      count: 2,
      title: "NABH Clinical Licenses Expiring in 14 Days",
      detail: "2 clinical consultants have state medical council licenses due for statutory renewal.",
      section: "compliance",
    },
    {
      kind: "pending_approvals",
      severity: "warning" as const,
      count: 4,
      title: "Pending Staff Leave & Overtime Approvals",
      detail: "4 pending leave requests require departmental supervisor sign-off.",
      section: "approvals",
    },
    {
      kind: "training_audit",
      severity: "info" as const,
      count: 1,
      title: "Annual BLS/ACLS Resuscitation Re-certification",
      detail: "Next hospital-wide batch scheduled for this Saturday at the Clinical Skills Lab.",
      section: "training",
    },
  ],
}

export const MOCK_SHIFTS = [
  { id: "SH-01", hospital_id: "HOSP-01", name: "Morning Clinical Shift", code: "MORN", start_time: "07:00", end_time: "15:00", duration_hours: 8, is_active: true },
  { id: "SH-02", hospital_id: "HOSP-01", name: "Evening Clinical Shift", code: "EVE", start_time: "15:00", end_time: "23:00", duration_hours: 8, is_active: true },
  { id: "SH-03", hospital_id: "HOSP-01", name: "Night Emergency Shift", code: "NIGHT", start_time: "23:00", end_time: "07:00", duration_hours: 8, is_active: true },
  { id: "SH-04", hospital_id: "HOSP-01", name: "General Administration", code: "GEN", start_time: "09:00", end_time: "17:30", duration_hours: 8.5, is_active: true },
]

export const MOCK_LEAVES = [
  {
    id: "LV-901",
    employee_id: "EMP-102",
    employee_name: "Dr. Priya Nair",
    leave_type: "Casual Leave",
    start_date: "2026-11-12",
    end_date: "2026-11-13",
    days: 2,
    reason: "Attending National Emergency Medicine Conference",
    status: "approved",
    approved_by: "Medical Superintendent",
    created_at: "2026-11-05T10:30:00Z",
  },
  {
    id: "LV-902",
    employee_id: "EMP-106",
    employee_name: "Mary Fernandez",
    leave_type: "Sick Leave",
    start_date: "2026-11-10",
    end_date: "2026-11-10",
    days: 1,
    reason: "Severe Migraine",
    status: "pending",
    approved_by: null,
    created_at: "2026-11-09T08:15:00Z",
  },
]

export const MOCK_APPROVALS = [
  {
    id: "APP-01",
    kind: "leave",
    title: "Casual Leave Application",
    submitted_by: "Kavitha Raman (Senior Staff Nurse)",
    department: "Emergency & Trauma Center",
    details: "12 Nov to 14 Nov (3 days) - Family Function",
    status: "pending",
    created_at: "2026-11-08T14:20:00Z",
  },
  {
    id: "APP-02",
    kind: "overtime",
    title: "Overtime Duty Verification (4 hrs)",
    submitted_by: "Ramesh Babu (Lab Tech)",
    department: "Pathology & Laboratory",
    details: "Emergency cross-match batch coverage on Sunday night",
    status: "pending",
    created_at: "2026-11-09T09:00:00Z",
  },
]

export const MOCK_PAYROLL = [
  {
    id: "PAY-2026-10",
    period: "October 2026",
    month: 10,
    year: 2026,
    status: "disbursed",
    total_staff: 158,
    gross_payout: 8450000,
    statutory_pf: 520000,
    statutory_esi: 110000,
    tds_deductions: 400000,
    net_payout: 7420000,
    disbursed_at: "2026-10-31T18:00:00Z",
  },
  {
    id: "PAY-2026-09",
    period: "September 2026",
    month: 9,
    year: 2026,
    status: "disbursed",
    total_staff: 156,
    gross_payout: 8320000,
    statutory_pf: 512000,
    statutory_esi: 108000,
    tds_deductions: 390000,
    net_payout: 7310000,
    disbursed_at: "2026-09-30T18:00:00Z",
  },
]

export const MOCK_RECRUITMENT = [
  {
    id: "REQ-01",
    title: "Fellowship Cardiologist (Interventional)",
    department: "Cardiology & Cath Lab",
    open_positions: 2,
    applied_count: 14,
    interview_count: 4,
    status: "open",
    priority: "high",
    posted_date: "2026-10-20",
  },
  {
    id: "REQ-02",
    title: "ICU Staff Nurse (Critical Care Certified)",
    department: "Critical Care & ICU",
    open_positions: 5,
    applied_count: 28,
    interview_count: 8,
    status: "open",
    priority: "urgent",
    posted_date: "2026-10-25",
  },
]

export const MOCK_TRAINING = [
  {
    id: "TRN-01",
    title: "Basic Life Support (BLS) & ACLS Resuscitation Protocol",
    category: "Clinical Mandatory",
    validity_months: 24,
    enrolled_count: 45,
    compliance_rate_pct: 94,
    next_batch: "2026-11-15",
  },
  {
    id: "TRN-02",
    title: "Hospital Infection Prevention & Biomedical Waste (NABH)",
    category: "Quality & Safety",
    validity_months: 12,
    enrolled_count: 120,
    compliance_rate_pct: 98,
    next_batch: "2026-11-20",
  },
]

export const MOCK_ANNOUNCEMENTS = [
  {
    id: "ANN-01",
    title: "NABH 5th Edition Re-Accreditation Internal Audit Scheduled",
    author: "Hospital Administration",
    date: "08 Nov 2026",
    content: "All clinical and non-clinical department heads are requested to ensure SOP manuals, credential files, and equipment calibration certificates are updated by Thursday.",
    pinned: true,
  },
  {
    id: "ANN-02",
    title: "Staff Annual Health Checkup & Vaccination Drive",
    author: "Occupational Health & HR",
    date: "05 Nov 2026",
    content: "Free annual health checkup, Hepatitis B booster doses, and influenza vaccination available for all on-duty hospital personnel at Room 104.",
    pinned: false,
  },
]

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
    return MOCK_DASHBOARD
  }

  if (p.includes("/facets")) {
    return {
      employee_category: MOCK_DASHBOARD.employees.by_category,
      status: MOCK_DASHBOARD.employees.by_status,
    }
  }

  if (p.includes("/employment") || p.includes("/history") || p.includes("/audit") || p.includes("/notes")) {
    return []
  }

  if (p.includes("/attendance/devices") || p.includes("/devices")) {
    return [
      { id: "DEV-01", name: "Main Entrance Biometric Scanner", model: "eSSL SilkBio-101", ip_address: "192.168.1.201", status: "online", last_heartbeat: new Date().toISOString() },
      { id: "DEV-02", name: "ER & Trauma Biometric Scanner", model: "eSSL SilkBio-101", ip_address: "192.168.1.202", status: "online", last_heartbeat: new Date().toISOString() },
      { id: "DEV-03", name: "OT & Sterile Zone Access Terminal", model: "ZKTeco ProCapture-X", ip_address: "192.168.1.203", status: "online", last_heartbeat: new Date().toISOString() },
      { id: "DEV-04", name: "ICU Biometric Terminal", model: "ZKTeco ProCapture-X", ip_address: "192.168.1.204", status: "online", last_heartbeat: new Date().toISOString() },
    ]
  }

  if (p.includes("/attendance/punches") || p.includes("/punches")) {
    return { items: [], total: 0, page: 1, page_size: 50 }
  }

  if (p.match(/\/employees\/[^\/]+$/)) {
    const parts = p.split("/")
    const empId = parts[parts.length - 1]
    const found = MOCK_EMPLOYEES.find((e) => e.id === empId || e.employee_code.toLowerCase() === empId.toLowerCase())
    if (found) {
      return {
        ...found,
        gender: "male",
        email: `${found.employee_code.toLowerCase()}@apollohospital.org`,
        date_of_birth: "1985-06-15",
        blood_group: "O+",
        pan_number: "ABCDE1234F",
        aadhaar_last4: "9876",
        emergency_contact_name: "Family Member",
        emergency_contact_phone: "+91 98765 00000",
        address: "Jubilee Hills, Hyderabad",
        base_salary: 120000,
        statutory: { pf_opt_out: false, esi_eligible: false, pt_applicable: true },
        credentials: [
          {
            id: `cred-${found.id}`,
            credential_type: "State Medical Council Registration",
            number: "MCI-44012",
            issued_by: "Medical Council of India",
            valid_from: "2020-01-01",
            valid_to: "2027-12-31",
            verified: true,
          },
        ],
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

  if (p.includes("/attendance/live") || p.includes("/workforce/on-duty")) {
    return {
      date: new Date().toISOString().split("T")[0],
      departments: MOCK_DASHBOARD.department_presence.map((dp) => ({
        department: dp.department,
        rostered: dp.scheduled,
        checked_in: dp.present,
      })),
      staff: MOCK_EMPLOYEES.map((e) => ({
        employee_id: e.id,
        name: e.full_name,
        designation: e.designation,
        category: e.employee_category,
        department: e.department || "General",
        shift: "Morning (07:00 - 15:00)",
        shift_end: "15:00",
        checked_in: true,
      })),
    }
  }

  if (p.includes("/attendance/daily") || p.includes("/attendance")) {
    return {
      items: MOCK_EMPLOYEES.map((e) => ({
        id: `att-${e.id}`,
        employee_id: e.id,
        employee_name: e.full_name,
        employee_code: e.employee_code,
        department: e.department,
        shift_name: "Morning Shift",
        check_in: "06:55",
        check_out: "15:05",
        status: "present",
        late_minutes: 0,
        overtime_minutes: 0,
      })),
      total: MOCK_EMPLOYEES.length,
      page: 1,
      page_size: 50,
      summary: { present: 154, absent: 2, leave: 2, late: 3 },
    }
  }

  if (p.includes("/workforce/shifts") || p.includes("/shifts")) {
    return MOCK_SHIFTS
  }

  if (p.includes("/workforce/coverage") || p.includes("/coverage")) {
    return {
      rows: MOCK_DEPARTMENTS.map((d) => ({
        department: d.name,
        required: 8,
        allocated: 8,
        actual: 8,
        shortage: 0,
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
    return { runs: MOCK_PAYROLL, current: MOCK_PAYROLL[0] }
  }

  if (p.includes("/recruitment")) {
    return { requisitions: MOCK_RECRUITMENT }
  }

  if (p.includes("/training/matrix")) {
    return {
      programs: MOCK_TRAINING.map((t) => ({ id: t.id, code: t.id, title: t.title })),
      rows: MOCK_EMPLOYEES.map((e) => ({
        employee_id: e.id,
        employee_name: e.full_name,
        category: e.employee_category,
        cells: {
          "TRN-01": { state: "valid", expires_on: "2027-10-01" },
          "TRN-02": { state: "valid", expires_on: "2027-04-15" },
        },
      })),
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
