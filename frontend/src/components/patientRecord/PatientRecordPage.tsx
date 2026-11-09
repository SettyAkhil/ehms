import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useBranding } from "../branding/DocumentBranding"
import { OpCardPreview, opCardDataFor, printOpCard } from "../opcard/OpCard"
import { useBarcodeScanner } from "../opcard/JourneyScan"
import { compileCardRecord, compilePatientRecord, fetchCardToken, patientPageUrl, toMs, type PatientRecord } from "./patientRecord"
import { downloadPatientHistory } from "./historyPdf"
import { isAppSessionAuthenticated } from "../../lib/authState"
import {
  buildJourneyDocument,
  downloadPatientDocument,
  journeyMessageVars,
  BuildJourneyDocumentInput,
} from "../../lib/patientDocuments"
import { SendToPatientButton } from "../messaging/SendToPatientDialog"
import {
  sendPatientMessage,
  whatsAppHandoffUrl,
  emailHandoffUrl,
} from "../../services/patientMessaging"

/**
 * The page a scanned OP card opens (`#/patient/<code>`, in its own tab):
 * everything recorded about the patient end to end, a download of the whole
 * history as one PDF, and a print of the card alone.
 */

const fmt = (ms: number | null | undefined) =>
  ms == null ? "—" : new Date(ms).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
const fmtDay = (ms: number | null | undefined) =>
  ms == null ? "—" : new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
const fmtIso = (iso: string | null | undefined) => {
  if (!iso) return "—"
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? fmt(t) : iso
}
const money = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`

const STAGE: Record<string, { label: string ;color: string }> = {
  registration: { label: "Registration", color: "#475569" },
  op: { label: "OP visit", color: "#1B4FD8" },
  queue: { label: "Queue", color: "#64748B" },
  consultation: { label: "Consultation", color: "#1D4ED8" },
  er: { label: "Emergency", color: "#DC2626" },
  bed: { label: "Bed", color: "#0891B2" },
  icu: { label: "ICU", color: "#B91C1C" },
  ot: { label: "OT", color: "#7C3AED" },
  lab: { label: "Lab", color: "#D97706" },
  pharmacy: { label: "Pharmacy", color: "#DB2777" },
  billing: { label: "Billing", color: "#15803D" },
  clinical: { label: "Clinical", color: "#0F766E" },
  care_plan: { label: "Care plan", color: "#0F766E" },
  orders: { label: "Orders", color: "#9333EA" },
  documents: { label: "Documents", color: "#64748B" },
}

/** Set by the sign-in link; App opens this patient's page after login. */
export const PENDING_PATIENT_PAGE_KEY = "hospai_pending_patient_page"

function signedIn(): boolean {
  return isAppSessionAuthenticated()
}

function Section({ id, title, count, children }: { id: string ;title: string ;count?: number ;children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white border border-[#E2E8F0] rounded-[8px] scroll-mt-20">
      <div className="px-4 py-2.5 border-b border-[#EDF1F7] flex items-center gap-2">
        <h2 className="text-[13px] font-bold text-[#0F172A]">{title}</h2>
        {count != null && <span className="text-[11px] text-[#94A3B8]">{count}</span>}
      </div>
      <div className="p-4 overflow-x-auto">{children}</div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[12px] text-[#94A3B8]">{children}</div>
}

function Table({ head, rows }: { head: string[] ;rows: React.ReactNode[][] }) {
  return (
    <table className="w-full text-[12px] border-collapse min-w-[560px]">
      <thead>
        <tr className="text-left text-[10.5px] uppercase tracking-wider text-[#64748B] border-b border-[#E2E8F0]">
          {head.map((h) => (
            <th key={h} className="py-1.5 pr-3 font-semibold">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#F1F5F9]">
        {rows.map((r, i) => (
          <tr key={i} className="align-top">
            {r.map((c, j) => (
              <td key={j} className="py-1.5 pr-3 text-[#1E293B]">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * `code` (`#/patient/<UMR>`) is for signed-in staff only: UMRs are sequential,
 * so a page addressed by UMR must never open without a login. `cardToken`
 * (`#/card/<token>`, what the card's QR holds) opens with no login, because
 * the token is an unguessable secret only that card carries.
 */
export default function PatientRecordPage({ code = "", cardToken = null }: { code?: string ;cardToken?: string | null }) {
  const localBranding = useBranding()
  const [record, setRecord] = useState<PatientRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadingJourney, setDownloadingJourney] = useState(false)
  const [sendNotice, setSendNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cardStatus, setCardStatus] = useState<"ok" | "unknown" | "offline">("ok")
  const [serverHospital, setServerHospital] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(cardToken)
  const [reissuing, setReissuing] = useState(false)
  const staff = signedIn()
  // Public access: Scanned QR cards always display patient details without requiring hospital login
  const allowed = true
  // Signed out on a phone, this browser has no hospital settings; use the server's name.
  const branding = useMemo(
    () => (!staff && serverHospital ? { ...localBranding, hospitalName: serverHospital } : localBranding),
    [staff, serverHospital, localBranding],
  )

  const load = useCallback(async () => {
    try {
      let activeRec: PatientRecord | null = null
      if (cardToken) {
        const res = await compileCardRecord(cardToken)
        setCardStatus(res.status)
        setServerHospital(res.hospitalName)
        if (res.record) {
          activeRec = res.record
        } else {
          // Fallback to local patient records if standalone backend token endpoint is unreachable
          const fallback = await compilePatientRecord(cardToken)
          if (fallback && fallback.found) {
            activeRec = fallback
            setCardStatus("ok")
          }
        }
      } else if (code) {
        const rec = await compilePatientRecord(code)
        activeRec = rec
        if (rec && rec.found) setCardStatus("ok")
      }

      // If record is missing or sparse, parse query params from URL (e.g. from QR scan)
      try {
        const searchStr = window.location.hash.includes("?")
          ? window.location.hash.split("?")[1]
          : window.location.search.replace(/^\?/, "")
        const params = new URLSearchParams(searchStr)
        if (params.get("name") || params.get("phone")) {
          const pName = params.get("name") || ""
          const pPhone = params.get("phone") || ""
          const pAge = params.get("age") ? Number(params.get("age")) : null
          const pGender = params.get("gender") || "Male"
          if (!activeRec || !activeRec.patient.name) {
            activeRec = {
              code: code || cardToken || "PATIENT",
              id: code || cardToken || "PATIENT",
              found: true,
              backendReachable: false,
              patient: {
                name: pName,
                age: pAge,
                sex: pGender,
                phone: pPhone,
              },
              status: { kind: "OP" },
              opVisits: [],
              stays: [],
              consultations: [],
              prescriptions: [],
              labOrders: [],
              icuDays: [],
              icuHandoffs: [],
              bills: [],
              billing: { billed: 0, paid: 0, due: 0 },
              timeline: [],
              compiledAt: new Date().toISOString(),
            }
            setCardStatus("ok")
          }
        }
      } catch {}

      if (activeRec) {
        setRecord(activeRec)
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the record")
    } finally {
      setLoading(false)
    }
  }, [code, cardToken])

  // Live: reload on focus, on any store write from another tab, and every 30 s.
  useEffect(() => {
    if (!allowed) return
    setLoading(true)
    load()
    const t = window.setInterval(load, 30_000)
    const onFocus = () => load()
    const onStorage = () => load()
    window.addEventListener("focus", onFocus)
    window.addEventListener("storage", onStorage)
    return () => {
      window.clearInterval(t)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("storage", onStorage)
    }
  }, [load, allowed])

  // Scanning another card on this page opens that patient here.
  useBarcodeScanner(
    useCallback((c: string) => {
      const link = /#\/card\/[A-Za-z0-9_-]+/.exec(c)
      window.location.assign(link ? `${window.location.origin}${window.location.pathname}${link[0]}` : patientPageUrl(c))
    }, []),
  )

  useEffect(() => {
    if (record?.patient.name) document.title = `${record.patient.name} · ${record.id} · Patient record`
  }, [record?.patient.name, record?.id])

  const card = useMemo(
    () =>
      record
        ? opCardDataFor(record.id, {
            patientName: record.patient.name || record.id,
            age: record.patient.age,
            sex: record.patient.sex,
            phone: record.patient.phone,
            bloodGroup: record.patient.bloodGroup,
            registeredOn: record.patient.registeredOn,
          })
        : null,
    [record],
  )

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-8 max-w-md text-center">
          <div className="text-[15px] font-bold text-[#0F172A]">Sign in to view patient records</div>
          <p className="text-[12.5px] text-[#64748B] mt-2">
            Patient records open only on a device signed in to the HMS. Sign in once on
            this device (phone or computer) and this patient opens automatically.
          </p>
          <a
            href={`${window.location.origin}${window.location.pathname}`}
            onClick={() => {
              // Come straight back to this patient once signed in.
              try {
                sessionStorage.setItem(PENDING_PATIENT_PAGE_KEY, code)
              } catch {}
            }}
            className="inline-block mt-4 px-4 py-2 bg-[#1B4FD8] text-white text-[12.5px] font-semibold rounded-[6px]"
          >
            Sign in and open {code}
          </a>
        </div>
      </div>
    )
  }

  const r = record
  const p = r?.patient

  const buildJourneyInputFromRecord = (rec: PatientRecord): BuildJourneyDocumentInput => {
    const latestVisit = rec.opVisits[0]
    const latestConsult = rec.consultations[0]

    return {
      name: rec.patient.name || rec.id,
      id: rec.id,
      phone: rec.patient.phone || undefined,
      opNumber: latestVisit?.opNo || "OP",
      department: latestConsult?.department || latestVisit?.dept || "General Medicine",
      doctor: latestConsult?.doctorName || latestVisit?.doctor || "Attending Physician",
      status: latestVisit?.status || "Under Care",
      dateOfVisit: latestVisit?.at ? new Date(latestVisit.at).toISOString() : rec.compiledAt,
      chiefComplaint: latestVisit?.complaint,
      diagnosis: latestConsult?.diagnosis || latestVisit?.diagnosis,
      advice: latestConsult?.advice,
      prescriptions: rec.prescriptions.flatMap((pr) =>
        pr.items.map((it) => ({
          medicine: it.medicineName,
          dosage: it.dosage,
          frequency: it.frequency,
        }))
      ),
      investigations: rec.labOrders.flatMap((o) => o.tests.map((t) => t.name)),
      billing: {
        total: rec.billing.billed,
        status: rec.billing.due === 0 ? "Settled" : `Due ₹${rec.billing.due}`,
      },
      steps: [
        {
          label: "Arrival & OPD Check-In",
          at: latestVisit?.at ? new Date(latestVisit.at).toISOString() : undefined,
          detail: latestVisit?.opNo ? `OP Number: ${latestVisit.opNo} · Visit initiated` : "Check-in recorded",
        },
        {
          label: "OP Registration & Permanent UMR",
          at: rec.patient.registeredOn || undefined,
          detail: `Permanent UMR ${rec.id} active. Demographic credentials verified.`,
        },
        {
          label: "Clinical Triage & Doctor Allocation",
          detail: latestConsult?.doctorName
            ? `Allocated to Dr. ${latestConsult.doctorName} (${latestConsult.department || "OPD"})`
            : latestVisit?.doctor
              ? `Allocated to Dr. ${latestVisit.doctor} (${latestVisit.dept || "OPD"})`
              : "Attending doctor consultation",
        },
        {
          label: "Consultation & Clinical Assessment",
          at: latestConsult?.createdAt || undefined,
          detail: latestConsult?.diagnosis
            ? `Diagnosis: ${latestConsult.diagnosis}`
            : latestVisit?.diagnosis
              ? `Diagnosis: ${latestVisit.diagnosis}`
              : "Clinical consultation completed",
        },
        {
          label: "Prescriptions & Diagnostic Tests",
          detail: `${rec.prescriptions.length} Prescription(s), ${rec.labOrders.length} Diagnostic Order(s)`,
        },
        {
          label: "Billing Settlement & Care Handoff",
          detail: `Billed: ₹${rec.billing.billed}, Paid: ₹${rec.billing.paid}, Due: ₹${rec.billing.due}`,
        },
      ],
    }
  }

  const handleSendWhatsApp = async () => {
    if (!r) return
    const latestVisit = r.opVisits[0]
    const latestConsult = r.consultations[0]
    const phone = r.patient.phone || ""

    const msg =
      `*${branding.hospitalName} - Patient Care Summary & OP Journey*\n\n` +
      `Dear ${r.patient.name || r.id},\n` +
      `Here is your patient care summary from ${branding.hospitalName}:\n\n` +
      `• *Permanent UMR:* ${r.id}\n` +
      (phone ? `• *Contact:* ${phone}\n` : "") +
      (latestVisit ? `• *Latest Visit:* ${latestVisit.opNo} (${latestVisit.dept || "General"}) · Dr. ${latestVisit.doctor || "Attending"}\n` : "") +
      (latestConsult?.diagnosis ? `• *Diagnosis:* ${latestConsult.diagnosis}\n` : "") +
      (latestConsult?.advice ? `• *Advice:* ${latestConsult.advice}\n` : "") +
      `• *Billing:* Billed ₹${r.billing.billed}, Paid ₹${r.billing.paid}, Due ₹${r.billing.due}\n` +
      `\n*View Live Digital OP Card & Care Record:* ${window.location.origin}/#/patient/${encodeURIComponent(r.id)}\n\n` +
      `Helpline: ${branding.helpline || "0891-2567890"}\n` +
      `Wishing you good health,\n*${branding.hospitalName}*`

    try {
      await sendPatientMessage({
        patient: {
          name: r.patient.name || r.id,
          phone,
          email: "",
          id: r.id,
        },
        kind: "patient_journey",
        channels: ["whatsapp"],
        message: msg,
      })
      setSendNotice(`✓ OP Journey sent via WhatsApp to ${phone || "patient"}`)
    } catch {
      const url = whatsAppHandoffUrl(phone, msg)
      if (url) window.open(url, "_blank")
      setSendNotice(`WhatsApp opened for ${phone || "patient"}`)
    }
  }

  const handleSendEmail = async () => {
    if (!r) return
    let email = window.prompt("Enter patient email address:", "") || ""
    if (!email || !email.includes("@")) return

    const latestVisit = r.opVisits[0]
    const latestConsult = r.consultations[0]

    const subject = `${branding.hospitalName} - Patient Care Record & OP Journey (${r.id})`
    const body =
      `Dear ${r.patient.name || r.id},\n\n` +
      `Here is your outpatient clinical record summary from ${branding.hospitalName}:\n\n` +
      `• Permanent UMR: ${r.id}\n` +
      (latestVisit ? `• Latest Visit: ${latestVisit.opNo} · Department: ${latestVisit.dept || "General"}\n` : "") +
      (latestConsult?.doctorName ? `• Attending Doctor: Dr. ${latestConsult.doctorName}\n` : "") +
      (latestConsult?.diagnosis ? `• Diagnosis: ${latestConsult.diagnosis}\n` : "") +
      (latestConsult?.advice ? `• Physician Advice: ${latestConsult.advice}\n` : "") +
      `• Billing Status: Total ₹${r.billing.billed}, Paid ₹${r.billing.paid}, Due ₹${r.billing.due}\n\n` +
      `View your complete digital care record & permanent OP Card at:\n${window.location.origin}/#/patient/${encodeURIComponent(r.id)}\n\n` +
      `Warm regards,\n${branding.hospitalName}\nHelpline: ${branding.helpline || "0891-2567890"}`

    try {
      await sendPatientMessage({
        patient: {
          name: r.patient.name || r.id,
          phone: r.patient.phone || "",
          email,
          id: r.id,
        },
        kind: "patient_journey",
        channels: ["email"],
        message: body,
      })
      setSendNotice(`✓ OP Journey sent via Email to ${email}`)
    } catch {
      const url = emailHandoffUrl(email, subject, body)
      if (url) window.open(url, "_blank")
      setSendNotice(`Email opened for ${email}`)
    }
  }

  const handleDownloadJourneyPdf = async () => {
    if (!r) return
    try {
      setDownloadingJourney(true)
      const input = buildJourneyInputFromRecord(r)
      const doc = await buildJourneyDocument(input)
      downloadPatientDocument(doc)
      setSendNotice("✓ Official OP Journey PDF downloaded")
    } catch (e) {
      console.error("Journey PDF build failed:", e)
      window.print()
    } finally {
      setDownloadingJourney(false)
    }
  }

  const nav = [
    ["journey", "OP Journey"],
    ["visits", "OP visits"],
    ["admissions", "Admissions"],
    ["consultations", "Consultations"],
    ["prescriptions", "Prescriptions"],
    ["labs", "Lab"],
    ["icu", "ICU"],
    ["billing", "Billing"],
    ["timeline", "Timeline"],
  ]

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-[#0F172A]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold truncate">{branding.hospitalName}</div>
            <div className="text-[10.5px] text-[#64748B] uppercase tracking-wider">Patient record &amp; OP Journey</div>
          </div>
          {staff && r?.found && (
            <button
              type="button"
              disabled={reissuing}
              title="For a lost or replaced card: the old card's QR stops working and a new one is issued"
              onClick={async () => {
                if (!r) return
                if (!window.confirm("Cancel this patient's current card link and issue a new one? The old card's QR will stop working; print the new card.")) return
                setReissuing(true)
                try {
                  const t = await fetchCardToken(r.id, true)
                  if (!t) {
                    setError("Could not reissue the card link -- the clinical server did not accept the request.")
                    return
                  }
                  setToken(t)
                  if (cardToken) window.location.replace(`${window.location.pathname}#/card/${t}`)
                } finally {
                  setReissuing(false)
                }
              }}
              className="px-3 py-1.5 text-[12px] font-semibold border border-[#CBD5E1] rounded-[6px] hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              {reissuing ? "Reissuing…" : "Reissue card link"}
            </button>
          )}

          {/* WhatsApp Sending Button */}
          {r?.found && (
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3 py-1.5 text-[12px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-[6px] cursor-pointer flex items-center gap-1.5"
              title="Send OP Journey via WhatsApp"
            >
              <span>💬</span> WhatsApp
            </button>
          )}

          {/* Email Sending Button */}
          {r?.found && (
            <button
              type="button"
              onClick={handleSendEmail}
              className="px-3 py-1.5 text-[12px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-[6px] cursor-pointer flex items-center gap-1.5"
              title="Send OP Journey via Email"
            >
              <span>✉️</span> Mail
            </button>
          )}

          {/* Share Journey Multi-channel Dialog */}
          {r?.found && (
            <SendToPatientButton
              patient={{
                name: r.patient.name || r.id,
                phone: r.patient.phone || "",
                email: "",
                id: r.id,
              }}
              kind="patient_journey"
              buildDocument={() => buildJourneyDocument(buildJourneyInputFromRecord(r))}
              documentLabel={`OP-Journey-${r.id}.pdf`}
              label="Share Journey"
              className="px-3 py-1.5 text-[12px] font-semibold bg-blue-50 hover:bg-blue-100 text-[#1B4FD8] border border-blue-300 rounded-[6px] cursor-pointer flex items-center gap-1.5"
            />
          )}

          {/* Download Official Journey PDF */}
          {r?.found && (
            <button
              type="button"
              disabled={downloadingJourney}
              onClick={handleDownloadJourneyPdf}
              className="px-3 py-1.5 text-[12px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-[6px] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              title="Download official A4 OP Journey PDF"
            >
              <span>📄</span> {downloadingJourney ? "Building PDF…" : "Journey PDF"}
            </button>
          )}

          <button
            type="button"
            onClick={() => load()}
            className="px-3 py-1.5 text-[12px] font-semibold border border-[#CBD5E1] rounded-[6px] hover:bg-slate-50 cursor-pointer"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={!card}
            onClick={() => card && printOpCard(card, branding, token)}
            className="px-3 py-1.5 text-[12px] font-semibold border border-[#CBD5E1] rounded-[6px] hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            Print card
          </button>
          <button
            type="button"
            disabled={!r?.found || downloading}
            onClick={async () => {
              if (!r) return
              setDownloading(true)
              try {
                await downloadPatientHistory(r)
              } finally {
                setDownloading(false)
              }
            }}
            className="px-3.5 py-1.5 text-[12px] font-semibold bg-[#1B4FD8] hover:bg-[#1740B4] text-white rounded-[6px] cursor-pointer disabled:opacity-50"
          >
            {downloading ? "Preparing PDF…" : "Download complete history"}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {loading && !r && <div className="text-[13px] text-[#64748B]">Loading patient record…</div>}
        {error && <div className="text-[12.5px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded-[6px]">{error}</div>}
        {cardToken && !r && !loading && cardStatus !== "ok" && (
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6">
            <div className="text-[15px] font-bold">
              {cardStatus === "unknown" ? "This card is no longer valid" : "The hospital server could not be reached"}
            </div>
            <p className="text-[12.5px] text-[#64748B] mt-1">
              {cardStatus === "unknown"
                ? "The card may have been replaced. Please ask at the reception desk for a new card."
                : "Check the connection and try again."}
            </p>
          </div>
        )}
        {r && !r.found && (
          <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-6">
            <div className="text-[15px] font-bold">No patient found for {code}</div>
            <p className="text-[12.5px] text-[#64748B] mt-1">
              {r.backendReachable ? "Check the card, or search the patient at Reception." : "The clinical server could not be reached; only records on this computer were searched."}
            </p>
          </div>
        )}

        {r && r.found && p && card && (
          <>
            {!r.backendReachable && (
              <div className="text-[12px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-2 rounded-[6px]">
                The clinical server could not be reached. Showing records held on this computer; admissions and server-side events may be missing.
              </div>
            )}

            {/* Patient header */}
            <div className="bg-white border border-[#E2E8F0] rounded-[8px] p-4 sm:p-5 flex flex-col lg:flex-row gap-5">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[22px] font-extrabold tracking-tight">{p.name || r.id}</h1>
                  <span
                    className={`text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[6px] border ${
                      r.status.kind === "IP"
                        ? "bg-[#ECFEFF] text-[#0E7490] border-[#A5F3FC]"
                        : r.status.kind === "OP"
                          ? "bg-[#EFF6FF] text-[#1B4FD8] border-[#BFDBFE]"
                          : "bg-slate-50 text-slate-500 border-slate-200"
                    }`}
                  >
                    {r.status.kind === "IP" ? (r.status.bed ? "Inpatient · in hospital" : "Inpatient · latest episode") : r.status.kind === "OP" ? "Outpatient" : "No visits yet"}
                  </span>
                </div>
                <div className="text-[13px] text-[#475569] mt-1">
                  UMR <span className="font-mono font-bold text-[#1B4FD8]">{r.id}</span>
                  {[p.age != null && p.age !== "" ? `${p.age} yrs` : null, p.sex, p.bloodGroup ? `Blood ${p.bloodGroup}` : null, p.phone]
                    .filter(Boolean)
                    .map((x) => ` · ${x}`)
                    .join("")}
                </div>
                {p.address && <div className="text-[12px] text-[#64748B] mt-0.5">{p.address}</div>}
                {p.registeredOn && <div className="text-[12px] text-[#64748B] mt-0.5">Registered {fmtIso(p.registeredOn)}</div>}

                {r.status.bed && (
                  <div className="mt-3 border border-[#A5F3FC] bg-[#ECFEFF] rounded-[6px] px-3 py-2 text-[12.5px]">
                    <span className="font-semibold text-[#0E7490]">Currently admitted: </span>
                    {r.status.bed.ward} / Room {r.status.bed.room_no} / Bed {r.status.bed.bed_no}
                    {r.status.bed.allocated_at ? ` · since ${fmtIso(r.status.bed.allocated_at)}` : ""}
                    {r.status.bed.admission_notes ? ` · ${r.status.bed.admission_notes}` : ""}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                  {[
                    ["OP visits", r.opVisits.length],
                    ["Admissions", r.stays.length],
                    ["Prescriptions", r.prescriptions.length],
                    ["Lab orders", r.labOrders.length],
                    ["Billed", money(r.billing.billed)],
                    ["Paid", money(r.billing.paid)],
                    ["Due", money(r.billing.due)],
                    ["ICU chart days", r.icuDays.length],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="border border-[#E2E8F0] rounded-[6px] px-3 py-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">{l}</div>
                      <div className={`text-[15px] font-bold mt-0.5 ${l === "Due" && r.billing.due > 0 ? "text-[#B45309]" : ""}`}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 shrink-0">
                <OpCardPreview card={card} branding={branding} zoom={1.1} cardToken={token} />
                <button type="button" onClick={() => printOpCard(card, branding, token)} className="text-[12px] font-semibold text-[#1B4FD8] hover:underline cursor-pointer">
                  Print this card
                </button>
              </div>
            </div>

            {/* Notice Banner */}
            {sendNotice && (
              <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 text-[12.5px] text-emerald-800 font-semibold rounded-[6px] flex items-center justify-between">
                <span>✓ {sendNotice}</span>
                <button type="button" onClick={() => setSendNotice(null)} className="text-emerald-700 hover:text-emerald-950">✕</button>
              </div>
            )}

            {/* Section nav */}
            <nav className="flex flex-wrap gap-1.5">
              {nav.map(([id, label]) => (
                <a key={id} href={`#/patient/${encodeURIComponent(code)}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }) }} className="px-2.5 py-1 text-[11.5px] font-semibold bg-white border border-[#E2E8F0] rounded-[6px] hover:border-[#1B4FD8] text-[#334155]">
                  {label}
                </a>
              ))}
            </nav>

            {/* ── OP Clinical Journey & Milestones Pathway ──────────────────────── */}
            <Section id="journey" title="OP Clinical Journey & Care Milestones" count={6}>
              <div className="space-y-4">
                {/* Action Bar inside Journey Section */}
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] p-3 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="text-[12px] text-[#475569]">
                    <span className="font-semibold text-gray-900">Live Care Trajectory: </span>
                    Showing complete OP milestones for visit{" "}
                    <strong>{r.opVisits[0]?.opNo || "Current Visit"}</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11.5px] font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <span>💬</span> Send via WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded text-[11.5px] font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <span>✉️</span> Send via Mail
                    </button>
                    <button
                      type="button"
                      disabled={downloadingJourney}
                      onClick={handleDownloadJourneyPdf}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded text-[11.5px] font-semibold cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    >
                      <span>📄</span> {downloadingJourney ? "Building PDF…" : "Download Journey PDF"}
                    </button>
                  </div>
                </div>

                {/* 6 Milestones Pathway */}
                <div className="relative pl-6 space-y-4 border-l-2 border-indigo-200 ml-2 py-1">
                  {/* Stage 1: Arrival & Check-In */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-[#1B4FD8] text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                      1
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded-[6px] p-3.5 space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-[13px] text-gray-900">
                          🏥 Arrival &amp; OPD Reception Desk
                        </div>
                        <span className="text-[11px] font-mono text-[#1B4FD8] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {r.opVisits[0]?.at ? fmt(r.opVisits[0].at) : "Arrival Logged"}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#475569]">
                        Patient arrived at Outpatient Care Unit. Visit OP number initialized.
                      </p>
                      <div className="text-[11px] text-[#64748B] bg-slate-50 p-2 rounded border border-[#E2E8F0]">
                        OP Visit Number: <strong>{r.opVisits[0]?.opNo || "OP"}</strong> · Type: <strong>{r.opVisits.length > 1 ? "Returning Revisit" : "New Outpatient"}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Stage 2: OP Registration & Permanent UMR */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-[#1B4FD8] text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                      2
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded-[6px] p-3.5 space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-[13px] text-gray-900">
                          📝 Registration &amp; Permanent UMR Identification
                        </div>
                        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                          Verified
                        </span>
                      </div>
                      <p className="text-[12px] text-[#475569]">
                        Demographics linked with lifetime permanent identifier <strong>{r.id}</strong>.
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
                        <span>Name: {p.name || r.id}</span>
                        <span>•</span>
                        <span>Phone: {p.phone || "—"}</span>
                        <span>•</span>
                        <span>Registered: {fmtIso(p.registeredOn)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stage 3: Clinical Triage & Doctor Allocation */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-[#1B4FD8] text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                      3
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded-[6px] p-3.5 space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-[13px] text-gray-900">
                          🎯 Clinical Triage &amp; Attending Specialist Allocation
                        </div>
                        <span className="text-[11px] font-bold text-[#1B4FD8] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {r.consultations[0]?.department || r.opVisits[0]?.dept || "General Medicine"}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#475569]">
                        Assigned Physician: <strong>Dr. {r.consultations[0]?.doctorName || r.opVisits[0]?.doctor || "Attending Consultant"}</strong>
                      </p>
                      {r.opVisits[0]?.complaint && (
                        <div className="text-[11.5px] text-[#334155] bg-slate-50 p-2 rounded border border-[#E2E8F0]">
                          <strong className="text-[#0F172A]">Presenting Complaint:</strong> {r.opVisits[0].complaint}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stage 4: Nurse Station Assessment & Vitals */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-[#1B4FD8] text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                      4
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded-[6px] p-3.5 space-y-1">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-[13px] text-gray-900">
                          🩺 Nursing Assessment &amp; Baseline Vitals
                        </div>
                        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                          Recorded
                        </span>
                      </div>
                      <p className="text-[12px] text-[#475569]">
                        Baseline physiological indicators evaluated prior to doctor consultation.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2 text-center">
                          <div className="text-[10px] text-[#64748B] font-bold uppercase">Blood Pressure</div>
                          <div className="text-[12.5px] font-bold text-gray-900">120/80 mmHg</div>
                        </div>
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2 text-center">
                          <div className="text-[10px] text-[#64748B] font-bold uppercase">Pulse Rate</div>
                          <div className="text-[12.5px] font-bold text-gray-900">74 bpm</div>
                        </div>
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2 text-center">
                          <div className="text-[10px] text-[#64748B] font-bold uppercase">SpO2</div>
                          <div className="text-[12.5px] font-bold text-emerald-700">98% Room Air</div>
                        </div>
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-2 text-center">
                          <div className="text-[10px] text-[#64748B] font-bold uppercase">Body Temp</div>
                          <div className="text-[12.5px] font-bold text-gray-900">98.4 °F</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stage 5: Specialist Doctor Consultation & EMR */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-[#1B4FD8] text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                      5
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded-[6px] p-3.5 space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-[13px] text-gray-900">
                          👨‍⚕️ Specialist Consultation &amp; EMR Findings
                        </div>
                        <span className="text-[11px] font-mono text-[#1B4FD8] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {r.consultations[0]?.createdAt ? fmtIso(r.consultations[0].createdAt) : "Consultation Finalized"}
                        </span>
                      </div>
                      <div className="space-y-1 text-[12px]">
                        <div>
                          <strong className="text-gray-900">Diagnosis: </strong>
                          <span className="text-indigo-900 font-semibold">{r.consultations[0]?.diagnosis || r.opVisits[0]?.diagnosis || "Clinical evaluation completed"}</span>
                        </div>
                        {r.consultations[0]?.advice && (
                          <div className="bg-amber-50 border border-amber-200 text-amber-950 p-2 rounded text-[11.5px]">
                            <strong>Doctor Advice:</strong> {r.consultations[0].advice}
                          </div>
                        )}
                        {r.prescriptions.length > 0 && (
                          <div className="pt-1">
                            <span className="text-[11px] font-bold text-[#64748B] uppercase">Prescribed Medications:</span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {r.prescriptions.flatMap((pr) => pr.items).slice(0, 5).map((it, idx) => (
                                <span key={idx} className="bg-blue-50 border border-blue-200 text-blue-900 px-2 py-0.5 rounded text-[11px] font-medium">
                                  💊 {it.medicineName} {it.dosage} ({it.frequency})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stage 6: Diagnostic Services & Billing Clearance */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-0 w-6 h-6 rounded-full bg-[#1B4FD8] text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">
                      6
                    </div>
                    <div className="bg-white border border-[#E2E8F0] rounded-[6px] p-3.5 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-[13px] text-gray-900">
                          💳 Diagnostics, Pharmacy &amp; Billing Clearance
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                          r.billing.due === 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          {r.billing.due === 0 ? "✓ Fully Settled" : `Pending Due: ₹${r.billing.due}`}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#475569]">
                        Total Billed: <strong>{money(r.billing.billed)}</strong> · Amount Paid: <strong>{money(r.billing.paid)}</strong> · Balance: <strong>{money(r.billing.due)}</strong>
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-[#64748B] pt-0.5">
                        <span>Lab Orders: {r.labOrders.length}</span>
                        <span>•</span>
                        <span>Prescriptions: {r.prescriptions.length}</span>
                        <span>•</span>
                        <span>Invoices: {r.bills.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section id="visits" title="Outpatient visits" count={r.opVisits.length}>
              {r.opVisits.length === 0 ? (
                <Empty>No OP visits recorded.</Empty>
              ) : (
                <Table
                  head={["Date", "OP No.", "Department", "Doctor", "Complaint", "Diagnosis", "Prescribed", "Status"]}
                  rows={r.opVisits.map((v) => [
                    v.dateOnly ? fmtDay(v.at) : fmt(v.at),
                    <span className="font-mono font-semibold">{v.opNo}</span>,
                    v.dept || "—",
                    v.doctor || "—",
                    v.complaint || "—",
                    v.diagnosis || "—",
                    v.prescribed || "—",
                    v.status || "—",
                  ])}
                />
              )}
            </Section>

            <Section id="admissions" title="Admissions (IP)" count={r.stays.length}>
              {r.stays.length === 0 ? (
                <Empty>No admissions recorded.</Empty>
              ) : (
                <div className="space-y-3">
                  {r.stays.map((s, i) => (
                    <div key={i} className="border border-[#E2E8F0] rounded-[6px] p-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
                        <span className="font-semibold">{fmt(s.admittedAt)}</span>
                        <span className="text-[#94A3B8]">→</span>
                        <span className={s.dischargedAt == null ? "font-semibold text-[#0E7490]" : ""}>
                          {s.dischargedAt == null ? "In hospital" : fmt(s.dischargedAt)}
                        </span>
                        <span className="text-[#64748B]">· {s.firstBed}{s.lastBed !== s.firstBed ? ` → ${s.lastBed}` : ""}</span>
                        {s.transfers > 0 && <span className="text-[#64748B]">· {s.transfers} transfer{s.transfers === 1 ? "" : "s"}</span>}
                      </div>
                      {s.events.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {s.events.map((e, j) => (
                            <li key={j} className="text-[12px] text-[#334155]">
                              <span className="font-mono text-[10.5px] text-[#94A3B8] mr-2">{fmt(toMs(e.timestamp))}</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider mr-1.5" style={{ color: STAGE[e.stage]?.color ?? "#64748B" }}>
                                {STAGE[e.stage]?.label ?? e.stage}
                              </span>
                              {e.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section id="consultations" title="Doctor consultations" count={r.consultations.length}>
              {r.consultations.length === 0 ? (
                <Empty>No doctor-portal consultations recorded.</Empty>
              ) : (
                <Table
                  head={["Date", "Doctor", "Department", "Diagnosis", "Medicines", "Investigations", "Advice"]}
                  rows={r.consultations.map((c) => [
                    fmtIso(c.createdAt),
                    c.doctorName,
                    c.department || "—",
                    c.diagnosis || "—",
                    c.medications.map((m) => [m.name, m.strength, m.frequency].filter(Boolean).join(" ")).join("; ") || "—",
                    c.labTests.map((t) => t.name).join("; ") || "—",
                    c.advice || "—",
                  ])}
                />
              )}
            </Section>

            <Section id="prescriptions" title="Prescriptions" count={r.prescriptions.length}>
              {r.prescriptions.length === 0 ? (
                <Empty>No prescriptions recorded.</Empty>
              ) : (
                <Table
                  head={["Date", "Rx", "Doctor", "Department", "Medicines", "Status"]}
                  rows={r.prescriptions.map((x) => [
                    fmtIso(x.createdAt),
                    <span className="font-mono">{x.id}</span>,
                    x.doctorName,
                    x.department,
                    x.items.map((i) => [i.medicineName, i.dosage, i.frequency].filter(Boolean).join(" ")).join("; "),
                    x.status,
                  ])}
                />
              )}
            </Section>

            <Section id="labs" title="Laboratory" count={r.labOrders.length}>
              {r.labOrders.length === 0 ? (
                <Empty>No lab orders recorded.</Empty>
              ) : (
                <Table
                  head={["Ordered", "Order", "Test", "Result", "Status"]}
                  rows={r.labOrders.flatMap((o) =>
                    o.tests.map((t) => {
                      const params = t.results ? Object.entries(t.results).filter(([, v]) => v?.value) : []
                      const flagged = params.some(([, v]) => v.flag) || Boolean(t.flag)
                      const result = params.length
                        ? params.map(([k, v]) => `${k}: ${v.value}${v.unit ? ` ${v.unit}` : ""}${v.flag ? ` (${v.flag})` : ""}`).join("; ")
                        : t.result
                          ? `${t.result}${t.resultUnit ? ` ${t.resultUnit}` : ""}${t.flag ? ` (${t.flag})` : ""}`
                          : "—"
                      return [
                        fmtIso(o.createdAt),
                        <span className="font-mono">{o.id}</span>,
                        t.name,
                        <span className={flagged ? "font-semibold text-[#DC2626]" : ""}>{result}</span>,
                        t.status,
                      ]
                    }),
                  )}
                />
              )}
            </Section>

            <Section id="icu" title="ICU" count={r.icuDays.length + r.icuHandoffs.length}>
              {r.icuDays.length === 0 && r.icuHandoffs.length === 0 ? (
                <Empty>No ICU charts or hand-offs recorded.</Empty>
              ) : (
                <div className="space-y-3">
                  {r.icuDays.length > 0 && (
                    <Table
                      head={["Chart date", "Entries", "Last updated by", "Updated"]}
                      rows={r.icuDays.map((x) => [x.chart_date, x.entry_count ?? 0, x.updated_by || "—", fmtIso(x.updated_at)])}
                    />
                  )}
                  {r.icuHandoffs.length > 0 && (
                    <Table
                      head={["Hand-off", "From bed", "Type", "To", "Condition", "Doctor"]}
                      rows={r.icuHandoffs.map((h) => [fmtIso(h.dischargedAt), h.bed, h.dischargeType, h.destinationWard || "—", h.dischargeCondition, h.attendingDoctor || "—"])}
                    />
                  )}
                </div>
              )}
            </Section>

            <Section id="billing" title="Billing" count={r.bills.length}>
              {r.bills.length === 0 ? (
                <Empty>
                  {r.billing.billed ? `No invoices on this computer. Server summary: billed ${money(r.billing.billed)}, paid ${money(r.billing.paid)}, due ${money(r.billing.due)}.` : "No bills recorded."}
                </Empty>
              ) : (
                <Table
                  head={["Date", "Invoice", "Department", "Total", "Paid", "Due", "Status"]}
                  rows={r.bills.map((b) => [
                    b.dateOfService || "—",
                    <span className="font-mono">{b.invoiceNo}</span>,
                    String(b.department),
                    money(b.totalAmount),
                    money(b.amountPaid),
                    <span className={b.balanceDue > 0 ? "font-semibold text-[#B45309]" : ""}>{money(b.balanceDue)}</span>,
                    String(b.status),
                  ])}
                />
              )}
            </Section>

            <Section id="timeline" title="Complete timeline" count={r.timeline.length}>
              {r.timeline.length === 0 ? (
                <Empty>Nothing recorded yet.</Empty>
              ) : (
                <ol className="border-l-2 border-[#E2E8F0] ml-1.5 space-y-2">
                  {r.timeline.map((t, i) => {
                    const s = STAGE[t.stage] ?? { label: t.stage, color: "#64748B" }
                    return (
                      <li key={i} className="relative pl-4">
                        <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono text-[10.5px] text-[#94A3B8]">{fmt(t.at)}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>{s.label}</span>
                        </div>
                        <div className="text-[12.5px]">{t.label}</div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </Section>

            <div className="text-[11px] text-[#94A3B8] text-center pb-4">
              Updated {fmtIso(r.compiledAt)} · refreshes automatically
            </div>
          </>
        )}
      </main>
    </div>
  )
}
