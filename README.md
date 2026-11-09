# HospAI Enterprise Hospital Management System (HMS)

Enterprise-grade clinical operations, multi-department hospital administration, and role-based access control (RBAC) platform.

---

## 🚀 Quick Start (Automated Launch)

### On Windows
Run the automated PowerShell launcher:
```powershell
.\start.ps1
```
Or with npm:
```bash
npm run dev
```

### On Linux / macOS / WSL
```bash
chmod +x start.sh
./start.sh
```

The application will start automatically at **`http://localhost:8443`**.

---

## 🔑 Default Credentials

| Role | Username / ID | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` | `password123` | Full Hospital Platform & Administration |
| **Chief Physician** | `doctor` | `password123` | Doctor Portal, Encounters, Clinical |
| **Laboratory Technician** | `lab` | `password123` | Diagnostics, Specimen Collection, Lab Workbench |
| **Chief Pharmacist** | `pharmacy` | `password123` | Pharmacy & Dispensary, GRN, Stock Movement |
| **Staff Nurse** | `nurse` | `password123` | Nursing Station, Vitals, Triage |
| **Front Office Reception** | `reception` | `password123` | Patient Registration, Appointments, Queue |
| **Billing Executive** | `billing` | `password123` | Cash Desk, OP/IP Invoices, Receipts |
| **Insurance Officer** | `insurance` | `password123` | Pre-auth, Cashless Claims, TPA Decisions |
| **Finance Manager** | `finance` | `password123` | General Ledger, Chart of Accounts, Vouchers |
| **HR Manager** | `hr` | `password123` | Employees Master, Shifts, Attendance, Leaves |

---

## 🏥 Departments & Workspaces

1. **Administration & RBAC**: Dynamic custom roles, module-level and action-level permissions, individual staff accounts with custom module overrides, hospital masters, audit governance.
2. **Patient Reception & Registration**: Demographics intake, MRN generation, live appointment booking, patient messaging.
3. **Outpatient Department (OPD)**: Live queue board, nurse vitals station, OPD minor procedures.
4. **Clinical & Doctor Workspace**: Patient charting, clinical notes, electronic prescriptions, diagnosis history.
5. **Emergency Department (ED / ER)**: Rapid trauma intake, multi-tier triage, resuscitation bays.
6. **Inpatient Department (IPD)**: Bed board, ward transfers, admissions, discharges, readmission tracking.
7. **Critical Care (ICU / NICU)**: MICU, SICU, CCU, NICU, PICU telemetry beds and ventilators.
8. **Laboratory Diagnostics**: Orders, sample collection, lab workbench, quality analytics, finalized reports.
9. **Radiology & Imaging**: Worklist, scanning operations, reporting workspace, finalized reports, template upload.
10. **Pharmacy & Dispensary**: Dispensing, prescription ledger, GRN, expiry tracking, drug disposal.
11. **Operation Theatre & Surgery**: OT scheduling, surgical notes, anesthesia records.
12. **Billing & Cash Counter**: Unified patient bills, counter billing (OP/IP/ER), payment receipts.
13. **Insurance & TPA Claims**: Cashless pre-authorizations, claim document packs, query hub, settlements.
14. **Accounts & General Ledger**: Chart of accounts, vouchers, balance sheet, sub-ledgers.
15. **HRMS & Staff**: Employee rosters, biometric attendance, payroll, leave approvals.
16. **Hosp AI Intelligence**: Clinical RAG, symptom triage, OCR discharge summaries, NLP filtering.
17. **Hospital Analytics & Reports**: Departmental census, revenue statistics, doctor performance KPIs.

---

## 🛡️ Security & Role-Based Access Control

* **Interactive Authorization Enforcement**: Unauthorized department access is blocked by `DepartmentAccessDenied` with identity verification and quick links to authorized workspaces.
* **Granular Overrides**: Administrators can grant custom department combinations to individual staff accounts extending or overriding their role templates.
* **Persistent Session State**: Multi-tab synchronization and offline-safe local storage for seamless clinical continuity.
