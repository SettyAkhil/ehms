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

## 🔑 Signing In

There are no shared demo accounts. Sign-in is two steps: **select your role**, then enter the
User ID and password your administrator created for you. The server checks that the role
matches the one assigned to the account.

| Situation | First account |
| :--- | :--- |
| Local development (`npm run dev`) | `admin` / `Admin@123` (role: System Administrator) |
| Docker deployment | `admin` / the `INITIAL_ADMIN_PASSWORD` generated in `.env` |

The bootstrap admin is created only on an empty database, and its password is never reset
afterwards. Change it after the first sign-in, then create staff accounts in **Administration**.

---

## 🚢 Production Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)**: Docker Compose stack, databases, environment, backups
and operations.

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
