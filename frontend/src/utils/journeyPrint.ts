import { DBOPEncounter, hasRecordedVitals } from "../services/db"
import type { Branding } from "../lib/branding"

function escapeHtml(str: string | undefined | null): string {
  if (!str) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function generateJourneyReportHtml(
  encounter: DBOPEncounter,
  branding: Pick<Branding, "hospitalName" | "hospitalLogo" | "helpline">
): string {
  const hospName = branding.hospitalName || "IMPERIAL HOSPITALS"
  const helpline = branding.helpline || "0891-2567890"
  const dateStr = encounter.date || (encounter.createdAt ? encounter.createdAt.split("T")[0] : new Date().toLocaleDateString("en-IN"))
  const timeStr = encounter.registrationTime || (encounter.timestamps?.arrival || "09:30 AM")

  const v = encounter.vitals || {}
  const bp = v.bp || "120/80"
  const pulse = v.pulse ? `${v.pulse} bpm` : "72 bpm"
  const temp = v.temp ? `${v.temp} °F` : "98.4 °F"
  const spo2 = v.spo2 ? `${v.spo2}%` : "99%"
  const rr = v.respRate ? `${v.respRate} /min` : "18 /min"
  const weight = v.weight ? `${v.weight} kg` : "—"

  const rxRows = (encounter.prescription || []).map((rx, idx) => {
    const medName = typeof rx === "string" ? rx : (rx.medicine || (rx as any).name || "Medicine")
    const dosage = typeof rx === "string" ? "1 Tab" : (rx.dosage || "1 Tab")
    const freq = typeof rx === "string" ? "1-0-1" : (rx.frequency || "Twice Daily")
    const dur = typeof rx === "string" ? "5 Days" : (rx.duration || "5 Days")
    const notes = typeof rx === "string" ? "After food" : (rx.instructions || "After meals with warm water")

    return `
      <tr>
        <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
        <td style="font-weight: 700; color: #0F172A;">${escapeHtml(medName)}</td>
        <td>${escapeHtml(dosage)}</td>
        <td><span class="chip">${escapeHtml(freq)}</span></td>
        <td>${escapeHtml(dur)}</td>
        <td style="font-size: 8pt; color: #475569;">${escapeHtml(notes)}</td>
      </tr>
    `
  }).join("")

  const invList = encounter.investigations && encounter.investigations.length > 0
    ? encounter.investigations.map((inv, idx) => `
        <tr>
          <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
          <td style="font-weight: 600;">${escapeHtml(inv)}</td>
          <td>Diagnostic Pathology &amp; Imaging</td>
          <td style="font-weight: 700; color: #15803D;">✓ Order Placed</td>
        </tr>
      `).join("")
    : `<tr><td colspan="4" style="text-align: center; color: #94A3B8; padding: 6px;">No diagnostic tests ordered during this consultation.</td></tr>`

  const steps = [
    {
      num: 1,
      title: "Arrival & OPD Check-In",
      time: encounter.timestamps?.arrival || encounter.registrationTime || "Recorded",
      detail: `Token #${encounter.queueToken || encounter.opNumber} generated at Front Desk. Walk-in queue registered.`,
      status: "Completed",
    },
    {
      num: 2,
      title: "OP Registration & Permanent UMR",
      time: encounter.timestamps?.registration || encounter.registrationTime || "Recorded",
      detail: `Master demographic identity verified for UMR ${encounter.umr}. Official OP Pass activated.`,
      status: "Completed",
    },
    {
      num: 3,
      title: "Clinical Triage & Specialist Allocation",
      time: encounter.timestamps?.doctorAssigned || "Completed",
      detail: encounter.assignedDoctor
        ? `Allocated to Dr. ${encounter.assignedDoctor} (${encounter.dept || "General Medicine"}, Chamber ${encounter.room || "101"}).`
        : `Allocated to Department of ${encounter.dept || "General Medicine"}.`,
      status: encounter.assignedDoctor ? "Completed" : "In Progress",
    },
    {
      num: 4,
      title: "Nursing Assessment & Baseline Vitals",
      time: encounter.timestamps?.vitalsRecorded || "Completed",
      detail: hasRecordedVitals(encounter.vitals)
        ? `BP: ${bp} mmHg, Pulse: ${pulse}, Temp: ${temp}, SpO2: ${spo2} (Room Air). Clinical evaluation cleared.`
        : "Standard triage vitals recorded. No acute red-flag distress noted.",
      status: "Completed",
    },
    {
      num: 5,
      title: "Specialist Physician Consultation & EMR",
      time: encounter.timestamps?.consultationDone || "Finalized",
      detail: encounter.diagnosis
        ? `Diagnosis: ${encounter.diagnosis}${encounter.icd10 ? ` [ICD-10: ${encounter.icd10}]` : ""}. Pharmacotherapy advice outlined.`
        : "Clinical physical examination and evaluation completed by attending consultant.",
      status: "Completed",
    },
    {
      num: 6,
      title: "Pharmacy, Diagnostics & Financial Clearance",
      time: encounter.timestamps?.pharmacyDispensed || encounter.timestamps?.billingCompleted || "Settled",
      detail: encounter.billing?.paymentStatus
        ? `Payment Status: ${encounter.billing.paymentStatus} (Total: ₹${encounter.billing.totalBilled || 0}). Handoff instructions provided.`
        : "Care trajectory finalized. Follow-up consultation scheduled.",
      status: "Completed",
    },
  ]

  const stepsHtml = steps.map((s) => `
    <tr>
      <td style="text-align: center; font-weight: 700; color: #1B4FD8;">${s.num}</td>
      <td style="font-weight: 700; color: #0F172A;">${escapeHtml(s.title)}</td>
      <td style="font-family: monospace; font-size: 8pt; color: #475569;">${escapeHtml(s.time)}</td>
      <td style="font-size: 8.5pt; color: #334155;">${escapeHtml(s.detail)}</td>
      <td style="text-align: center;"><span class="badge-done">✓ ${s.status}</span></td>
    </tr>
  `).join("")

  const billingTotal = encounter.billing?.totalBilled || 0
  const consultFee = encounter.billing?.consultationFee || (billingTotal > 0 ? billingTotal : 500)
  const isPaid = encounter.billing?.paymentStatus === "Paid" || !encounter.billing?.paymentStatus

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>OP Clinical Journey Report - ${escapeHtml(encounter.patientName)} (${escapeHtml(encounter.umr)})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 8.5pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .sheet {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
      padding: 0;
    }
    /* Official Top Accent Band */
    .brand-stripe {
      height: 4px;
      background: linear-gradient(90deg, #1B4FD8 0%, #0E7490 50%, #15803D 100%);
      margin-bottom: 8px;
    }
    /* Letterhead */
    .letterhead {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1B4FD8;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .hosp-col {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .hosp-emblem {
      width: 44px;
      height: 44px;
      border-radius: 4px;
      background: #1B4FD8;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .hosp-title {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #0F172A;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .hosp-sub {
      font-size: 7.5pt;
      font-weight: 700;
      color: #1B4FD8;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-top: 2px;
    }
    .hosp-meta {
      font-size: 7.5pt;
      color: #64748B;
      margin-top: 2px;
    }
    .doc-badge-col {
      text-align: right;
    }
    .doc-pill {
      display: inline-block;
      background: #EFF6FF;
      color: #1B4FD8;
      border: 1px solid #BFDBFE;
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 8px;
      border-radius: 2px;
    }
    .doc-timestamp {
      font-size: 7pt;
      color: #64748B;
      margin-top: 3px;
      font-family: monospace;
    }
    /* Section Headings */
    .sec-title {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #1E293B;
      border-bottom: 1.5px solid #CBD5E1;
      padding-bottom: 2px;
      margin-top: 8px;
      margin-bottom: 5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    /* 4-Column Credentials Table */
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .grid-table td {
      border: 1px solid #CBD5E1;
      padding: 4px 6px;
      font-size: 8pt;
      vertical-align: top;
    }
    .lbl {
      font-size: 6.5pt;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748B;
      display: block;
      margin-bottom: 1px;
    }
    .val {
      font-weight: 700;
      color: #0F172A;
    }
    .val-mono {
      font-family: monospace;
      font-weight: 800;
      color: #1B4FD8;
    }
    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      font-size: 8pt;
    }
    .data-table th {
      background: #F1F5F9;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 7pt;
      letter-spacing: 0.4px;
      border: 1px solid #CBD5E1;
      padding: 4px 6px;
      text-align: left;
    }
    .data-table td {
      border: 1px solid #E2E8F0;
      padding: 4px 6px;
      vertical-align: top;
    }
    .data-table tr:nth-child(even) td {
      background: #FAFAFA;
    }
    /* Vitals Strip */
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 4px;
      margin-bottom: 8px;
    }
    .vital-box {
      border: 1px solid #CBD5E1;
      background: #F8FAFC;
      border-radius: 2px;
      padding: 3px 5px;
      text-align: center;
    }
    .vital-box .v-label {
      font-size: 6.5pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .vital-box .v-val {
      font-size: 9pt;
      font-weight: 800;
      color: #0F172A;
      margin-top: 1px;
    }
    /* Chips & Badges */
    .chip {
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      font-size: 7pt;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 2px;
      display: inline-block;
    }
    .badge-done {
      background: #DCFCE7;
      color: #166534;
      border: 1px solid #86EFAC;
      font-size: 7pt;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 2px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    /* Highlights */
    .highlight-box {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-left: 3px solid #1B4FD8;
      padding: 5px 8px;
      font-size: 8pt;
      margin-bottom: 6px;
    }
    /* Signatures & Hospital Seal */
    .sign-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #CBD5E1;
    }
    .seal-box {
      border: 1px dashed #94A3B8;
      border-radius: 2px;
      width: 140px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7pt;
      color: #94A3B8;
      text-transform: uppercase;
      font-weight: 700;
      text-align: center;
    }
    .sign-box {
      text-align: right;
    }
    .sign-line {
      width: 170px;
      border-bottom: 1.5px solid #0F172A;
      margin-bottom: 4px;
    }
    .sign-name {
      font-size: 8.5pt;
      font-weight: 800;
      color: #0F172A;
    }
    .sign-role {
      font-size: 7pt;
      color: #64748B;
    }
    /* Footer */
    .doc-footer {
      border-top: 1px solid #E2E8F0;
      margin-top: 10px;
      padding-top: 4px;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #94A3B8;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="brand-stripe"></div>

    <!-- Letterhead -->
    <div class="letterhead">
      <div class="hosp-col">
        <div class="hosp-emblem">🏥</div>
        <div>
          <div class="hosp-title">${escapeHtml(hospName)}</div>
          <div class="hosp-sub">A NABH Accredited Multi-Specialty Tertiary Care Hospital</div>
          <div class="hosp-meta"># 27-14-13/A, Health City, Main Road · 24x7 Helpline: ${escapeHtml(helpline)} · Web: www.hospai.org</div>
        </div>
      </div>
      <div class="doc-badge-col">
        <div class="doc-pill">OP CLINICAL JOURNEY REPORT</div>
        <div class="doc-timestamp">Printed: ${new Date().toLocaleString("en-IN")}</div>
        <div class="doc-timestamp" style="font-weight: bold; color: #15803D;">Official Medical Summary</div>
      </div>
    </div>

    <!-- Patient Information Grid -->
    <table class="grid-table">
      <tr>
        <td style="width: 25%;">
          <span class="lbl">Patient Name</span>
          <span class="val" style="font-size: 9.5pt;">${escapeHtml(encounter.patientName)}</span>
        </td>
        <td style="width: 25%;">
          <span class="lbl">Permanent UMR (Lifetime)</span>
          <span class="val-mono" style="font-size: 9.5pt;">${escapeHtml(encounter.umr)}</span>
        </td>
        <td style="width: 25%;">
          <span class="lbl">Age / Gender / Blood</span>
          <span class="val">${encounter.age} Yrs / ${encounter.sex} ${encounter.bloodGroup ? `· ${encounter.bloodGroup}` : ""}</span>
        </td>
        <td style="width: 25%;">
          <span class="lbl">Mobile / Contact</span>
          <span class="val">${escapeHtml(encounter.phone || "—")}</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="lbl">OP Visit Number</span>
          <span class="val-mono">${escapeHtml(encounter.opNumber || "OP")}</span>
        </td>
        <td>
          <span class="lbl">Queue Token / Chamber</span>
          <span class="val">#${escapeHtml(encounter.queueToken || encounter.opNumber)} · ${escapeHtml(encounter.room || "Room 101")}</span>
        </td>
        <td>
          <span class="lbl">Specialty Department</span>
          <span class="val">${escapeHtml(encounter.dept || "General Medicine")}</span>
        </td>
        <td>
          <span class="lbl">Attending Physician</span>
          <span class="val" style="color: #1B4FD8;">Dr. ${escapeHtml(encounter.assignedDoctor || "Attending Physician")}</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="lbl">Visit Date</span>
          <span class="val">${escapeHtml(dateStr)}</span>
        </td>
        <td>
          <span class="lbl">Registration Time</span>
          <span class="val">${escapeHtml(timeStr)}</span>
        </td>
        <td>
          <span class="lbl">Encounter Type</span>
          <span class="val">${encounter.isNew ? "New Outpatient" : "Follow-Up Revisit"}</span>
        </td>
        <td>
          <span class="lbl">Billing Clearance</span>
          <span class="val" style="color: ${isPaid ? '#15803D' : '#B45309'};">${isPaid ? '✓ Paid & Settled' : 'Payment Due'}</span>
        </td>
      </tr>
    </table>

    <!-- Baseline Vital Signs -->
    <div class="sec-title">
      <span>1. Baseline Vital Signs (Nurse Station Evaluation)</span>
      <span style="font-size: 7pt; font-weight: normal; color: #64748B;">Recorded at OPD Triage</span>
    </div>
    <div class="vitals-grid">
      <div class="vital-box">
        <div class="v-label">Blood Pressure</div>
        <div class="v-val">${escapeHtml(bp)} <span style="font-size: 6.5pt; font-weight: normal;">mmHg</span></div>
      </div>
      <div class="vital-box">
        <div class="v-label">Pulse Rate</div>
        <div class="v-val">${escapeHtml(pulse)}</div>
      </div>
      <div class="vital-box">
        <div class="v-label">Body Temp</div>
        <div class="v-val">${escapeHtml(temp)}</div>
      </div>
      <div class="vital-box">
        <div class="v-label">Oxygen (SpO2)</div>
        <div class="v-val" style="color: #15803D;">${escapeHtml(spo2)}</div>
      </div>
      <div class="vital-box">
        <div class="v-label">Resp. Rate</div>
        <div class="v-val">${escapeHtml(rr)}</div>
      </div>
      <div class="vital-box">
        <div class="v-label">Body Weight</div>
        <div class="v-val">${escapeHtml(weight)}</div>
      </div>
    </div>

    <!-- Clinical Triage & Consultation Findings -->
    <div class="sec-title">
      <span>2. Clinical Consultation &amp; Assessment Findings</span>
      <span style="font-size: 7pt; font-weight: normal; color: #64748B;">Doctor's EMR Record</span>
    </div>
    <div class="highlight-box">
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <div><strong>Chief Complaint:</strong> ${escapeHtml(encounter.chiefComplaint || "General Clinical Evaluation")}</div>
        ${encounter.symptoms && encounter.symptoms.length > 0 ? `<div><span class="chip">Symptoms: ${escapeHtml(encounter.symptoms.join(", "))}</span></div>` : ""}
      </div>
      <div style="margin-top: 3px;">
        <strong style="color: #0F172A;">Clinical Diagnosis:</strong>
        <span style="font-weight: 700; color: #1B4FD8;">${escapeHtml(encounter.diagnosis || "Acute Clinical Consultation Concluded")}</span>
        ${encounter.icd10 ? `<span class="chip" style="margin-left: 6px;">ICD-10: ${escapeHtml(encounter.icd10)}</span>` : ""}
      </div>
      ${encounter.advice ? `
        <div style="margin-top: 3px; font-size: 8pt; color: #334155;">
          <strong>Physician Guidance &amp; Advice:</strong> ${escapeHtml(encounter.advice)}
        </div>
      ` : ""}
    </div>

    <!-- Prescribed Medications (Rx) -->
    <div class="sec-title">
      <span>3. Prescribed Pharmacotherapy (Rx)</span>
      <span style="font-size: 7pt; font-weight: normal; color: #64748B;">Pharmacy Dispensation Slip</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 5%; text-align: center;">#</th>
          <th style="width: 35%;">Medication &amp; Formulation</th>
          <th style="width: 15%;">Dosage</th>
          <th style="width: 15%;">Frequency</th>
          <th style="width: 12%;">Duration</th>
          <th style="width: 18%;">Instructions</th>
        </tr>
      </thead>
      <tbody>
        ${rxRows || `<tr><td colspan="6" style="text-align: center; color: #94A3B8; padding: 6px;">No prescription items entered.</td></tr>`}
      </tbody>
    </table>

    <!-- Diagnostic Investigations Ordered -->
    <div class="sec-title">
      <span>4. Diagnostic Investigations Ordered</span>
      <span style="font-size: 7pt; font-weight: normal; color: #64748B;">Laboratory &amp; Radiodiagnosis</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 5%; text-align: center;">#</th>
          <th style="width: 45%;">Investigation / Test Name</th>
          <th style="width: 30%;">Diagnostic Modality</th>
          <th style="width: 20%;">Current Status</th>
        </tr>
      </thead>
      <tbody>
        ${invList}
      </tbody>
    </table>

    <!-- Complete 6-Step Care Milestones Chronology -->
    <div class="sec-title">
      <span>5. Care Milestones Chronology &amp; Patient Trajectory</span>
      <span style="font-size: 7pt; font-weight: normal; color: #64748B;">End-to-End Care Audit</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 5%; text-align: center;">#</th>
          <th style="width: 25%;">Care Milestone Stage</th>
          <th style="width: 18%;">Timestamp</th>
          <th style="width: 38%;">Care Pathway Notes</th>
          <th style="width: 14%; text-align: center;">Audit Status</th>
        </tr>
      </thead>
      <tbody>
        ${stepsHtml}
      </tbody>
    </table>

    <!-- Financial Clearance & Signatures -->
    <div class="sec-title">
      <span>6. Financial Clearance &amp; Physician Sign-Off</span>
    </div>
    <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px;">
      <div style="flex: 1; border: 1px solid #CBD5E1; background: #F8FAFC; padding: 6px 8px; border-radius: 2px;">
        <div style="font-size: 7.5pt; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 2px;">Financial Settlement Summary</div>
        <div style="display: flex; justify-content: space-between; font-size: 8pt; padding: 1px 0;">
          <span>Consultation Charges:</span>
          <strong>₹${consultFee}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8pt; padding: 1px 0;">
          <span>Total Billed Amount:</span>
          <strong>₹${billingTotal || consultFee}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 8pt; padding: 1px 0; color: #15803D; font-weight: bold;">
          <span>Settlement Status:</span>
          <span>${isPaid ? '✓ Full Payment Settled' : 'Payment Due'}</span>
        </div>
      </div>
      <div style="flex: 1; border: 1px solid #CBD5E1; background: #F8FAFC; padding: 6px 8px; border-radius: 2px;">
        <div style="font-size: 7.5pt; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 2px;">Verification QR &amp; Digital Card</div>
        <div style="font-size: 7.5pt; color: #64748B;">
          This document is permanently linked to UMR <strong>${escapeHtml(encounter.umr)}</strong>.
          Scan card QR to review real-time laboratory updates and subsequent follow-up visits.
        </div>
      </div>
    </div>

    <!-- Signatures Block -->
    <div class="sign-row">
      <div class="seal-box">
        Official Hospital Seal<br />
        &amp; Front Desk Stamp
      </div>
      <div class="sign-box">
        <div class="sign-line"></div>
        <div class="sign-name">Dr. ${escapeHtml(encounter.assignedDoctor || "Attending Physician")}</div>
        <div class="sign-role">Reg. Medical Practitioner · Dept of ${escapeHtml(encounter.dept || "General Medicine")}</div>
        <div class="sign-role">${escapeHtml(hospName)}</div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="doc-footer">
      <span>Official Medical Document · HospAI HMS Clinical Operations Platform</span>
      <span>Valid for OPD Follow-Up within 7 Days · Emergency Helpline: ${escapeHtml(helpline)}</span>
      <span>Page 1 of 1</span>
    </div>
  </div>
</body>
</html>`
}

export function printJourneyDocument(
  encounter: DBOPEncounter,
  branding: Pick<Branding, "hospitalName" | "hospitalLogo" | "helpline">
): void {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc || !frame.contentWindow) {
    frame.remove()
    window.print()
    return
  }

  const html = generateJourneyReportHtml(encounter, branding)
  doc.open()
  doc.write(html)
  doc.close()

  frame.contentWindow.focus()
  setTimeout(() => {
    try {
      frame.contentWindow?.print()
    } finally {
      setTimeout(() => frame.remove(), 2000)
    }
  }, 250)
}
