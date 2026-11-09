import React, { useState } from "react"
import { DBOPEncounter } from "../../services/db"
import { useBranding } from "../branding/DocumentBranding"
import { generateJourneyReportHtml, printJourneyDocument } from "../../utils/journeyPrint"
import { buildJourneyDocument, downloadPatientDocument, journeyMessageVars, BuildJourneyDocumentInput } from "../../lib/patientDocuments"
import { sendPatientMessage, whatsAppHandoffUrl, emailHandoffUrl } from "../../services/patientMessaging"
import { Icon } from "../icons"

interface JourneyReportPrintModalProps {
  encounter: DBOPEncounter
  onClose: () => void
}

export default function JourneyReportPrintModal({
  encounter,
  onClose,
}: JourneyReportPrintModalProps) {
  const branding = useBranding()
  const [downloading, setDownloading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const html = generateJourneyReportHtml(encounter, branding)

  const journeyInput: BuildJourneyDocumentInput = {
    name: encounter.patientName || "Patient",
    id: encounter.umr,
    phone: encounter.phone,
    email: (encounter as any).email || "",
    opNumber: encounter.opNumber,
    token: encounter.queueToken,
    department: encounter.dept,
    doctor: encounter.assignedDoctor,
    room: encounter.room,
    status: encounter.status,
    dateOfVisit: encounter.date || encounter.registrationTime || encounter.createdAt,
    chiefComplaint: encounter.chiefComplaint,
    symptoms: encounter.symptoms,
    vitals: encounter.vitals,
    diagnosis: encounter.diagnosis,
    icd10: encounter.icd10,
    advice: encounter.advice,
    prescriptions: (encounter.prescription || []).map((rx) => ({
      medicine: typeof rx === "string" ? rx : (rx as any).name || (rx as any).medicine || "",
      dosage: typeof rx === "string" ? "" : (rx as any).dosage || (rx as any).dose || "",
      frequency: typeof rx === "string" ? "" : (rx as any).frequency || "",
      duration: typeof rx === "string" ? "" : (rx as any).duration || "",
    })),
    investigations: encounter.investigations,
    billing: {
      total: encounter.billing?.totalBilled,
      status: encounter.billing?.paymentStatus,
    },
    steps: [
      {
        label: "Arrival & OPD Check-In",
        at: encounter.date || encounter.timestamps?.arrival || encounter.registrationTime,
        detail: `Token #${encounter.queueToken || encounter.opNumber} · ${encounter.isNew ? "New Outpatient" : "Returning Patient"}`,
      },
      {
        label: "OP Registration & UMR Verification",
        at: encounter.timestamps?.registration || encounter.registrationTime,
        detail: `Permanent UMR ${encounter.umr} confirmed. Official OP Pass active.`,
      },
      {
        label: "Triage & Specialty Doctor Allocation",
        at: encounter.timestamps?.doctorAssigned,
        detail: encounter.assignedDoctor
          ? `Allocated to ${encounter.assignedDoctor} (${encounter.dept || "General"})`
          : "Specialist allocation in progress",
      },
      {
        label: "Nursing Assessment & Vitals",
        at: encounter.timestamps?.vitalsRecorded,
        detail: encounter.vitals?.bp ? `BP: ${encounter.vitals.bp}, Pulse: ${encounter.vitals.pulse || "--"} bpm` : "Vitals evaluated",
      },
      {
        label: "Consultation & Clinical Assessment",
        at: encounter.timestamps?.consultationDone,
        detail: encounter.diagnosis ? `Diagnosis: ${encounter.diagnosis}` : "Consultation completed",
      },
      {
        label: "Discharge, Pharmacy & Handoff",
        at: encounter.timestamps?.pharmacyDispensed || encounter.timestamps?.billingCompleted,
        detail: encounter.billing?.paymentStatus ? `Status: ${encounter.billing.paymentStatus}` : "Visit completed",
      },
    ],
  }

  const handlePrint = () => {
    printJourneyDocument(encounter, branding)
  }

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true)
      const doc = await buildJourneyDocument(journeyInput)
      downloadPatientDocument(doc)
      setNotice("✓ Official OP Journey PDF downloaded successfully")
    } catch (e) {
      console.error("PDF download failed:", e)
      handlePrint()
    } finally {
      setDownloading(false)
    }
  }

  const handleSendWhatsApp = async () => {
    const cardMsg =
      `*${branding.hospitalName} - OP Clinical Journey Report*\n\n` +
      `Dear ${encounter.patientName},\n` +
      `Here is your OP Visit & Care Journey summary:\n\n` +
      `• *Permanent UMR:* ${encounter.umr}\n` +
      `• *OP Number:* ${encounter.opNumber || "OP"}\n` +
      `• *Attending Doctor:* ${encounter.assignedDoctor || "OPD Doctor"} (${encounter.dept || "General"})\n` +
      (encounter.diagnosis ? `• *Diagnosis:* ${encounter.diagnosis}\n` : "") +
      (encounter.advice ? `• *Advice:* ${encounter.advice}\n` : "") +
      `\n*View Live Digital OP Card & Care Record:* ${window.location.origin}/#/patient/${encodeURIComponent(encounter.umr)}\n\n` +
      `Helpline: ${branding.helpline || "0891-2567890"}\n` +
      `Wishing you good health,\n*${branding.hospitalName}*`

    try {
      await sendPatientMessage({
        patient: {
          name: encounter.patientName,
          phone: encounter.phone,
          email: (encounter as any).email,
          id: encounter.umr,
          encounterId: encounter.id,
        },
        kind: "patient_journey",
        channels: ["whatsapp"],
        message: cardMsg,
      })
      setNotice(`✓ Journey summary sent via WhatsApp to ${encounter.phone}`)
    } catch {
      const url = whatsAppHandoffUrl(encounter.phone, cardMsg)
      if (url) window.open(url, "_blank")
      setNotice(`WhatsApp opened for ${encounter.phone}`)
    }
  }

  const handleSendEmail = async () => {
    let email = (encounter as any).email || ""
    if (!email) {
      email = window.prompt("Enter patient email address:", "") || ""
    }
    if (!email || !email.includes("@")) return

    const emailSubject = `${branding.hospitalName} - OP Clinical Journey Report (${encounter.umr} · ${encounter.opNumber})`
    const emailBody =
      `Dear ${encounter.patientName},\n\n` +
      `Thank you for visiting ${branding.hospitalName}. Below is your outpatient care journey and consultation summary:\n\n` +
      `• Permanent UMR: ${encounter.umr}\n` +
      `• OP Visit Number: ${encounter.opNumber || "OP"}\n` +
      `• Attending Physician: ${encounter.assignedDoctor || "OPD Doctor"} (${encounter.dept || "General Medicine"})\n` +
      (encounter.diagnosis ? `• Diagnosis: ${encounter.diagnosis}\n` : "") +
      (encounter.advice ? `• Doctor Advice: ${encounter.advice}\n` : "") +
      `\nReview your digital OP Card & record at: ${window.location.origin}/#/patient/${encodeURIComponent(encounter.umr)}\n\n` +
      `Warm regards,\n${branding.hospitalName}`

    try {
      await sendPatientMessage({
        patient: {
          name: encounter.patientName,
          phone: encounter.phone,
          email,
          id: encounter.umr,
          encounterId: encounter.id,
        },
        kind: "patient_journey",
        channels: ["email"],
        message: emailBody,
      })
      setNotice(`✓ Journey report sent via Email to ${email}`)
    } catch {
      const url = emailHandoffUrl(email, emailSubject, emailBody)
      if (url) window.open(url, "_blank")
      setNotice(`Email client opened for ${email}`)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      {/* Top Floating Control Bar */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-t-lg shadow-xl flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-sm">
            📄
          </div>
          <div>
            <div className="text-[13.5px] font-bold flex items-center gap-2">
              <span>OP Clinical Journey — Official A4 Print Preview</span>
              <span className="font-mono text-[11px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-1.5 py-0.2 rounded">
                {encounter.opNumber}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Pixel-perfect medical summary document · UMR: {encounter.umr}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 bg-[#1B4FD8] hover:bg-[#1740B4] text-white text-[12px] font-bold rounded shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Print Clean A4 Document"
          >
            <Icon.Download /> 🖨️ Print Document
          </button>

          {/* Download PDF Button */}
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownloadPdf}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-semibold rounded shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            title="Download Official A4 PDF"
          >
            <span>📄</span> {downloading ? "Building PDF…" : "Download PDF"}
          </button>

          {/* WhatsApp Button */}
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold rounded shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Send Journey via WhatsApp"
          >
            <span>💬</span> WhatsApp
          </button>

          {/* Email Button */}
          <button
            type="button"
            onClick={handleSendEmail}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[12px] font-semibold rounded shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Send Journey via Email"
          >
            <span>✉️</span> Mail
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[12.5px] font-bold rounded cursor-pointer border border-slate-600 transition-colors ml-1"
            title="Close Preview"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Notice Feedback Banner */}
      {notice && (
        <div className="w-full max-w-4xl bg-emerald-600 text-white text-[12px] font-semibold px-4 py-1.5 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-white hover:text-emerald-200">✕</button>
        </div>
      )}

      {/* Interactive Clean A4 Paper Preview Container */}
      <div className="w-full max-w-4xl bg-slate-700/60 p-4 sm:p-8 flex justify-center items-center rounded-b-lg shadow-2xl overflow-x-auto">
        <iframe
          title="OP Clinical Journey A4 Print Preview"
          srcDoc={html}
          className="w-[210mm] min-h-[297mm] h-[1120px] bg-white shadow-2xl border border-slate-300 rounded-xs"
          style={{
            maxWidth: "100%",
            display: "block",
          }}
        />
      </div>
    </div>
  )
}
