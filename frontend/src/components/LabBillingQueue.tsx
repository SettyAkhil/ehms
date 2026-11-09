import React, { useEffect, useMemo, useState } from "react"
import { StatusBadge } from "./shared"
import { LabOrder, LabOrderDatabase } from "../services/labOrdersDb"
import { BillingDatabase, RadiologyStudyRecord, ClaimRecord, PaymentRecord } from "../services/billingDb"
import { RadiologyWorkflowDb, ExtendedRadiologyRecord } from "../services/radiologyWorkflowDb"
import { AuditDatabase } from "../services/auditDb"
import HospitalReceiptModal from "./HospitalReceiptModal"
import { BillingHeader, KpiTile } from "./billing/BillingChrome"
import { FlaskConical, Hourglass, Activity, Layers, Search, CheckCircle2, ShieldCheck, Printer } from "lucide-react"

/**
 * Common Unified Investigation Billing Queue:
 * Reception / Cashier side of the doctor -> investigation hand-off.
 *
 * Dynamically retrieves eligible investigation orders from BOTH Laboratory and Radiology.
 * Preserves original department, order ID, patient ID, UMR, OP, encounter ID, and investigation details.
 * Collecting payment releases the order to the respective department worklist (Lab or Radiology).
 */

const PAYMENT_MODES: Array<"Cash" | "Card" | "UPI" | "Corporate"> = [
  "Cash",
  "Card",
  "UPI",
  "Corporate",
]

export type UnifiedDepartment = "Laboratory" | "Radiology"

export interface UnifiedInvestigationItem {
  id: string
  name: string
  price: number
  urgency?: string
  modality?: string
  room?: string
}

export interface UnifiedInvestigationOrder {
  id: string // Department order ID (LAB-..., RAD-...)
  department: UnifiedDepartment
  patientName: string
  age?: number
  sex?: string
  umr: string
  opNumber: string
  encounterId?: string
  phone?: string
  doctorName: string
  consultingDepartment: string
  diagnosis?: string
  items: UnifiedInvestigationItem[]
  subtotal: number
  discount: number
  total: number
  status: "Awaiting Billing" | "Paid" | "Billed"
  paymentStatus: "Pending" | "Paid"
  createdAt: string
  paidAt?: string
  receiptNo?: string
  invoiceNo?: string
  mode?: string
  collectedBy?: string
  rawLabOrder?: LabOrder
  rawRadiologyStudy?: ExtendedRadiologyRecord | RadiologyStudyRecord
}

function labToUnified(order: LabOrder): UnifiedInvestigationOrder {
  const isPaid = order.billing.status === "Paid"
  return {
    id: order.id,
    department: "Laboratory",
    patientName: order.patientName,
    age: order.age,
    sex: order.sex,
    umr: order.umr,
    opNumber: order.opNumber,
    encounterId: order.encounterId,
    phone: order.phone,
    doctorName: order.doctorName,
    consultingDepartment: order.department || "General Medicine",
    diagnosis: order.diagnosis,
    items: (order.tests || []).map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price || 0,
      urgency: t.urgency,
    })),
    subtotal: order.billing.subtotal || (order.tests || []).reduce((acc, t) => acc + (t.price || 0), 0),
    discount: order.billing.discount || 0,
    total: order.billing.total || order.billing.subtotal || 0,
    status: isPaid ? "Billed" : "Awaiting Billing",
    paymentStatus: isPaid ? "Paid" : "Pending",
    createdAt: order.createdAt || new Date().toISOString(),
    paidAt: order.billing.paidAt,
    receiptNo: order.billing.receiptNo,
    invoiceNo: order.billing.invoiceNo,
    mode: order.billing.mode,
    collectedBy: order.billing.collectedBy,
    rawLabOrder: order,
  }
}

function radToUnified(study: ExtendedRadiologyRecord | RadiologyStudyRecord): UnifiedInvestigationOrder {
  const isPaid = Boolean(
    study.isPaid ||
    study.paymentStatus === "Paid" ||
    (study.paymentStatusDisplay || "").toUpperCase() === "PAID" ||
    (study as any).billingStatus === "Cleared / Paid" ||
    study.paidReceiptNo
  )
  const price = study.price || 500
  const opNumber =
    (study as any).opNumber ||
    (study.encounterId?.startsWith("OP-") ? study.encounterId : `OP-${(study.umr || study.mrn || "1002").replace(/\D/g, "")}`)
  const receiptNo =
    study.paidReceiptNo ||
    (isPaid ? `RCPT-2026-${(study.invoiceNo || study.id || "").replace(/\D/g, "").slice(-4) || "5501"}` : undefined)

  return {
    id: study.id,
    department: "Radiology",
    patientName: study.patient,
    age: (study as any).age,
    sex: (study as any).gender,
    umr: study.umr || study.mrn,
    opNumber,
    encounterId: study.encounterId,
    phone: "",
    doctorName: study.provider || "Attending Doctor",
    consultingDepartment: study.department || "Radiology",
    diagnosis: study.diagnosis || study.indication,
    items: [
      {
        id: study.id,
        name: `${study.study} (${study.modality})`,
        price,
        urgency: study.priority,
        modality: study.modality,
        room: study.room,
      },
    ],
    subtotal: price,
    discount: 0,
    total: price,
    status: isPaid ? "Billed" : "Awaiting Billing",
    paymentStatus: isPaid ? "Paid" : "Pending",
    createdAt: study.orderedAt || (study as any).createdAt || study.ordered || new Date().toISOString(),
    paidAt: study.paidAt || study.billingClearedAt,
    receiptNo,
    invoiceNo: study.invoiceNo,
    mode: (study as any).paymentMethod || "UPI / Digital",
    collectedBy: (study as any).collectedBy || "Reception",
    rawRadiologyStudy: study,
  }
}

export default function LabBillingQueue({
  collectedBy = "Reception",
}: {
  collectedBy?: string
}) {
  const [tick, setTick] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<"Cash" | "Card" | "UPI" | "Corporate">("Cash")
  const [discount, setDiscount] = useState<number>(0)
  const [view, setView] = useState<"pending" | "settled">("pending")
  const [deptFilter, setDeptFilter] = useState<"All" | "Laboratory" | "Radiology">("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [receipt, setReceipt] = useState<UnifiedInvestigationOrder | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [collectError, setCollectError] = useState<string | null>(null)

  useEffect(() => {
    const unsubLab = LabOrderDatabase.subscribe(() => setTick((t) => t + 1))
    const unsubRad = RadiologyWorkflowDb.subscribe(() => setTick((t) => t + 1))
    const unsubBilling = BillingDatabase.onUpdate(() => setTick((t) => t + 1))
    return () => {
      unsubLab()
      unsubRad()
      unsubBilling()
    }
  }, [])

  // 1. Retrieve Orders from BOTH Laboratory and Radiology
  const rawLabOrders = useMemo(() => LabOrderDatabase.getOrders(), [tick])
  const rawLabQueue = useMemo(() => LabOrderDatabase.getBillingQueue(), [tick])
  const rawRadStudies = useMemo(() => RadiologyWorkflowDb.getStudies(), [tick])

  const pendingLab = useMemo(() => rawLabQueue.map(labToUnified), [rawLabQueue])
  const pendingRad = useMemo(
    () =>
      rawRadStudies
        .filter((s) => !s.isPaid && s.paymentStatus !== "Paid" && (s.paymentStatusDisplay || "").toUpperCase() !== "PAID" && s.billingStatus !== "Authorized Exception")
        .map(radToUnified),
    [rawRadStudies]
  )

  const settledLab = useMemo(
    () => rawLabOrders.filter((o) => o.billing?.status === "Paid").map(labToUnified),
    [rawLabOrders]
  )
  const settledRad = useMemo(
    () =>
      rawRadStudies
        .filter((s) => s.isPaid || s.paymentStatus === "Paid" || (studyPaymentUpper(s) === "PAID") || s.billingStatus === "Authorized Exception")
        .map(radToUnified),
    [rawRadStudies]
  )

  function studyPaymentUpper(s: any): string {
    return (s.paymentStatusDisplay || "").toUpperCase()
  }

  const allPending = useMemo(() => {
    return [...pendingLab, ...pendingRad].sort((a, b) => {
      const timeB = new Date(b.createdAt || 0).getTime()
      const timeA = new Date(a.createdAt || 0).getTime()
      return timeB - timeA || b.id.localeCompare(a.id)
    })
  }, [pendingLab, pendingRad])

  const allSettled = useMemo(() => {
    return [...settledLab, ...settledRad].sort((a, b) => {
      const timeB = new Date(b.paidAt || b.createdAt || 0).getTime()
      const timeA = new Date(a.paidAt || a.createdAt || 0).getTime()
      return timeB - timeA || b.id.localeCompare(a.id)
    })
  }, [settledLab, settledRad])

  const currentDataset = view === "pending" ? allPending : allSettled

  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return currentDataset.filter((order) => {
      if (deptFilter !== "All" && order.department !== deptFilter) return false
      if (q) {
        const matches =
          order.patientName.toLowerCase().includes(q) ||
          order.umr.toLowerCase().includes(q) ||
          order.opNumber.toLowerCase().includes(q) ||
          order.id.toLowerCase().includes(q) ||
          order.doctorName.toLowerCase().includes(q) ||
          order.items.some((it) => it.name.toLowerCase().includes(q))
        if (!matches) return false
      }
      return true
    })
  }, [currentDataset, deptFilter, searchQuery])

  const selected = useMemo(
    () => filteredList.find((order) => order.id === selectedId) || filteredList[0],
    [filteredList, selectedId],
  )

  useEffect(() => {
    setDiscount(0)
  }, [selected?.id])

  const collect = async () => {
    if (!selected || selected.paymentStatus === "Paid" || collecting) return
    setCollectError(null)
    setCollecting(true)

    const nowIso = new Date().toISOString()
    const numericDiscount = Math.max(0, Math.min(Number(discount) || 0, selected.subtotal))
    const totalToPay = Math.max(0, selected.subtotal - numericDiscount)

    try {
      if (selected.department === "Laboratory") {
        // Laboratory Workflow Payment Settlement
        const updatedLab = await LabOrderDatabase.markBilled(selected.id, {
          mode: mode as any,
          discount: numericDiscount,
          collectedBy,
        })
        if (!updatedLab) throw new Error("Could not update Laboratory order in database.")

        // Sync with centralized billing
        try {
          BillingDatabase.recordPayment(updatedLab.billing.invoiceNo || selected.id, {
            amount: updatedLab.billing.total,
            paymentMethod: mode === "Cash" ? "Cash" : mode === "Card" ? "Debit Card" : "UPI / Digital",
            collectedBy,
            notes: `Laboratory investigation payment settled at Reception Desk.`,
          })
        } catch {}

        AuditDatabase.logEvent(
          "Lab Order Billed",
          "Billing",
          `${collectedBy} collected ₹${updatedLab.billing.total.toLocaleString("en-IN")} (${mode}) for ${updatedLab.id} — ` +
            `${updatedLab.tests.length} test(s) for ${updatedLab.patientName} (${updatedLab.umr}) released to Laboratory.`,
          "Success",
        )

        const unifiedReceipt = labToUnified(updatedLab)
        setReceipt(unifiedReceipt)
        setShowReceiptModal(true)
      } else {
        // Radiology Workflow Payment Settlement
        const receiptNo = `RCPT-2026-${Math.floor(1000 + Math.random() * 9000)}`

        // 1. Update Radiology Study in BillingDatabase
        const updatedStudy = BillingDatabase.updateRadiologyStudy(selected.id, {
          paymentStatus: "Paid",
          paymentStatusDisplay: "PAID",
          isPaid: true,
          paidReceiptNo: receiptNo,
          paidAt: nowIso,
          billingClearedAt: nowIso,
          eligibleAt: nowIso,
          billingStatus: "Cleared / Paid",
          normalizedStatus: "ORDERED",
          price: totalToPay,
        })

        // 2. Synchronize with Central Claims
        try {
          BillingDatabase.recordPayment(selected.invoiceNo || selected.id, {
            amount: totalToPay,
            paymentMethod: mode === "Cash" ? "Cash" : mode === "Card" ? "Debit Card" : "UPI / Digital",
            transactionRef: `TXN-${Date.now().toString().slice(-6)}`,
            collectedBy,
            notes: `Radiology investigation payment settled at Cashier Desk.`,
          })
        } catch {
          // Check matching claims
          const claims = BillingDatabase.getClaims()
          const matching = claims.find(
            (c) =>
              c.invoiceNo === selected.invoiceNo ||
              c.id === `CLM-${selected.id}` ||
              (selected.encounterId && c.encounterId === selected.encounterId)
          )
          if (matching) {
            BillingDatabase.recordPayment(matching.id, {
              amount: totalToPay,
              paymentMethod: mode === "Cash" ? "Cash" : mode === "Card" ? "Debit Card" : "UPI / Digital",
              collectedBy,
              notes: `Radiology investigation payment settled.`,
            })
          }
        }

        // 3. Trigger immediate updates
        try {
          new BroadcastChannel("hospai_rad_channel").postMessage("changed")
        } catch {}
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("hospai_rad_workflow_updated"))
        }

        AuditDatabase.logEvent(
          "Radiology Order Billed",
          "Billing",
          `${collectedBy} collected ₹${totalToPay.toLocaleString("en-IN")} (${mode}) for ${selected.id} — ` +
            `Radiology study ${selected.items[0]?.name || selected.id} for ${selected.patientName} (${selected.umr}) released for scanning. Receipt: ${receiptNo}.`,
          "Success",
        )

        const unifiedReceipt: UnifiedInvestigationOrder = {
          ...selected,
          status: "Billed",
          paymentStatus: "Paid",
          discount: numericDiscount,
          total: totalToPay,
          paidAt: nowIso,
          receiptNo,
          mode,
          collectedBy,
          rawRadiologyStudy: updatedStudy || selected.rawRadiologyStudy,
        }

        setReceipt(unifiedReceipt)
        setShowReceiptModal(true)
      }
    } catch (error) {
      setCollectError(
        error instanceof Error
          ? `Payment was not recorded: ${error.message}`
          : "Payment was not recorded. Please retry.",
      )
    } finally {
      setCollecting(false)
      setTick((t) => t + 1)
    }
  }

  const pendingTotal = allPending.reduce((sum, order) => sum + order.total, 0)
  const pendingLabCount = pendingLab.length
  const pendingRadCount = pendingRad.length

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1F5F9]">
      <BillingHeader
        icon={FlaskConical}
        title="Investigation Billing"
        pill="Laboratory & Radiology"
        subtitle="Centralized investigation cashier desk — payment confirms orders and releases them for departmental processing."
      />

      <div className="px-5 pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          tone="amber"
          icon={Hourglass}
          label="Awaiting Payment (All)"
          value={allPending.length}
          sub={`₹${pendingTotal.toLocaleString("en-IN")} total to collect`}
        />
        <KpiTile
          tone="sky"
          icon={FlaskConical}
          label="Laboratory Awaiting"
          value={pendingLabCount}
          sub="Diagnostic lab tests"
        />
        <KpiTile
          tone="purple"
          icon={Activity}
          label="Radiology Awaiting"
          value={pendingRadCount}
          sub="Imaging studies held for payment"
        />
        <KpiTile
          tone="emerald"
          icon={CheckCircle2}
          label="Settled Investigations"
          value={allSettled.length}
          sub="Cleared for departmental worklists"
        />
      </div>

      {/* Main Tabs (Awaiting Billing vs Settled) */}
      <div className="mx-5 mt-4 bg-white border border-[#CBD5E1] shadow-2xs flex flex-wrap items-center justify-between gap-3 p-1">
        <div className="flex">
          {[
            {
              key: "pending" as const,
              label: "Awaiting Billing",
              count: allPending.length,
            },
            {
              key: "settled" as const,
              label: "Settled Orders",
              count: allSettled.length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setView(tab.key)
                setSelectedId(null)
              }}
              className={`px-5 py-2.5 text-[12.5px] font-semibold border-b-2 transition-colors cursor-pointer ${
                view === tab.key
                  ? "border-[#1B4FD8] text-[#1B4FD8]"
                  : "border-transparent text-[#64748B] hover:text-[#334155]"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 text-[10px] font-bold bg-[#F1F5F9] text-[#475569] px-1.5 py-0.5 rounded">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter by Department */}
        <div className="flex items-center gap-2 pr-3">
          <div className="flex items-center bg-[#F1F5F9] p-0.5 rounded border border-[#CBD5E1] text-[11.5px]">
            {(["All", "Laboratory", "Radiology"] as const).map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => setDeptFilter(dept)}
                className={`px-3 py-1 rounded font-semibold transition-colors cursor-pointer ${
                  deptFilter === dept
                    ? "bg-white text-[#1B4FD8] shadow-2xs"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {dept === "All" ? `All (${currentDataset.length})` : dept === "Laboratory" ? `Laboratory (${currentDataset.filter(d => d.department === "Laboratory").length})` : `Radiology (${currentDataset.filter(d => d.department === "Radiology").length})`}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search patient, UMR, order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-white border border-[#CBD5E1] rounded text-[12px] text-[#334155] focus:outline-none focus:border-[#1B4FD8] w-48"
            />
          </div>
        </div>
      </div>

      {receipt && (
        <div className="mx-5 mt-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="text-[12.5px] text-[#166534] flex items-center gap-2">
            <span className="font-bold">✓ Payment collected</span> — receipt{" "}
            <span className="font-mono font-bold">{receipt.receiptNo}</span>
            , ₹{receipt.total.toLocaleString("en-IN")} for{" "}
            <span className="font-semibold">{receipt.patientName}</span>.{" "}
            <span className="font-mono font-bold text-slate-800">{receipt.id}</span>{" "}
            is now cleared for {receipt.department === "Radiology" ? "scanning in Radiology Operations" : "processing in Laboratory"}.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowReceiptModal(true)}
              className="text-[#15803D] hover:underline font-bold text-[12px] flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> View Receipt
            </button>
            <button
              type="button"
              onClick={() => setReceipt(null)}
              className="text-[#15803D] hover:text-green-800 font-bold text-[14px] cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="px-5 pb-5 pt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Investigation Orders List */}
        <div className="lg:col-span-2 bg-white border border-[#DDE2EC] rounded">
          <div className="px-4 py-2.5 border-b border-[#DDE2EC] flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-gray-900 flex items-center gap-2">
              <span>{view === "pending" ? "Investigations Awaiting Payment" : "Settled Investigations"}</span>
              <span className="text-[11px] font-normal text-slate-500">({filteredList.length} orders)</span>
            </h2>
            <span className="text-[11px] text-[#64748B]">Click order to review &amp; collect</span>
          </div>

          {filteredList.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-3xl mb-2">🧾</div>
              <p className="text-[13px] font-semibold text-[#334155]">
                {view === "pending"
                  ? "No investigations currently awaiting billing"
                  : "No settled investigation orders found"}
              </p>
              <p className="text-[11.5px] text-[#94A3B8] mt-1">
                Laboratory and Radiology investigations appear here immediately when ordered by a doctor.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9] max-h-[600px] overflow-y-auto">
              {filteredList.map((order) => {
                const isSelected = selected?.id === order.id
                const isRad = order.department === "Radiology"
                const hasStat = order.items.some((it) => it.urgency === "STAT")

                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                      isSelected ? "bg-[#EFF6FF] border-l-4 border-l-[#1B4FD8]" : "hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              isRad
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {isRad ? "☢️ Radiology" : "🔬 Laboratory"}
                          </span>
                          <span className="font-bold text-[13px] text-gray-900">
                            {order.patientName}
                          </span>
                          {(order.age || order.sex) && (
                            <span className="text-[11px] text-slate-500">
                              ({order.age ? `${order.age} Y` : ""}{order.age && order.sex ? " · " : ""}{order.sex || ""})
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-[#64748B]">
                            UMR: {order.umr} · {order.opNumber}
                          </span>
                          {hasStat && (
                            <span className="text-[9.5px] font-bold bg-[#FEE2E2] text-[#B91C1C] px-1.5 py-0.2 rounded border border-[#FECACA] animate-pulse">
                              STAT
                            </span>
                          )}
                        </div>

                        <div className="text-[11.5px] text-[#64748B] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-slate-800">Dr. {order.doctorName}</span>
                          <span>• {order.consultingDepartment}</span>
                          {order.diagnosis && <span>• {order.diagnosis}</span>}
                        </div>

                        <div className="text-[12px] font-semibold text-[#1E293B] mt-1 flex items-center gap-1.5 flex-wrap">
                          <span>Investigations:</span>
                          <span className="text-[#1B4FD8]">{order.items.map((it) => it.name).join(" · ")}</span>
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div className="text-[14px] font-bold text-gray-900 font-mono">
                          ₹{order.total.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10.5px] text-blue-700 font-mono font-bold mt-0.5">
                          {order.id}
                        </div>
                        <div className="mt-1">
                          {order.paymentStatus === "Paid" ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded">
                              ✓ PAID
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded">
                              ⏳ AWAITING BILLING
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Payment Collection & Order Review Dossier */}
        <div className="space-y-4">
          {selected ? (
            <div className="bg-white border border-[#DDE2EC] rounded shadow-2xs">
              <div className="px-4 py-2.5 border-b border-[#DDE2EC] flex items-center justify-between">
                <div>
                  <h2 className="text-[13px] font-bold text-gray-900">
                    {selected.paymentStatus === "Paid" ? "Official Receipt" : "Collect Investigation Payment"}
                  </h2>
                  <p className="text-[11px] text-[#64748B] font-mono mt-0.5">
                    Order Ref: <span className="font-bold text-[#1B4FD8]">{selected.id}</span>
                    {selected.invoiceNo && ` · ${selected.invoiceNo}`}
                  </p>
                </div>
                <span
                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded border ${
                    selected.department === "Radiology"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {selected.department}
                </span>
              </div>

              <div className="p-4 space-y-3">
                {/* Patient Summary Card */}
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded p-3 space-y-1">
                  {[
                    ["Patient Name", `${selected.patientName} (${selected.age || "—"} Y / ${selected.sex || "—"})`],
                    ["UMR Number", selected.umr],
                    ["OP / Encounter", `${selected.opNumber}${selected.encounterId ? ` • ${selected.encounterId}` : ""}`],
                    ["Referring Doctor", `Dr. ${selected.doctorName} (${selected.consultingDepartment})`],
                    ["Clinical Indication", selected.diagnosis || "Routine OPD diagnostic investigation"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 text-[11.5px]">
                      <span className="text-[#94A3B8]">{label}</span>
                      <span className="text-gray-900 font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Items Breakdown */}
                <div className="space-y-1 border-t border-slate-100 pt-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Ordered {selected.department} Tests / Studies:
                  </div>
                  {selected.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex justify-between gap-3 text-[12px] py-1 border-b border-[#F8FAFC] last:border-0"
                    >
                      <span className="text-[#475569] font-medium flex items-center gap-1">
                        <span>{item.name}</span>
                        {item.urgency === "STAT" && (
                          <span className="text-[#DC2626] font-bold text-[9.5px] bg-red-50 border border-red-200 px-1 rounded">
                            STAT
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-gray-900 font-semibold">
                        ₹{item.price.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>

                {selected.paymentStatus === "Paid" ? (
                  <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded p-3 text-[12px] text-[#166534] space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Amount Paid:</span>
                      <span className="font-mono font-bold">₹{selected.total.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Payment Mode:</span>
                      <span className="font-bold">{selected.mode || "Cash"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Official Receipt No:</span>
                      <span className="font-mono font-bold text-slate-900">{selected.receiptNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Collected By:</span>
                      <span>{selected.collectedBy || collectedBy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Settled At:</span>
                      <span>{selected.paidAt ? new Date(selected.paidAt).toLocaleString() : new Date().toLocaleString()}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowReceiptModal(true)}
                      className="w-full mt-2 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-xs cursor-pointer shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" /> View &amp; Print Official Receipt
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-[12px] pt-1 border-t border-[#E2E8F0]">
                      <span className="text-[#64748B]">Subtotal</span>
                      <span className="font-mono text-gray-900">
                        ₹{selected.subtotal.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] mb-1">
                        Discount (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={selected.subtotal}
                        value={discount === 0 ? "" : discount}
                        placeholder="0"
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === "") {
                            setDiscount(0)
                          } else {
                            const parsed = parseInt(val, 10)
                            setDiscount(isNaN(parsed) ? 0 : Math.max(0, Math.min(selected.subtotal, parsed)))
                          }
                        }}
                        className="w-full border border-[#DDE2EC] rounded px-3 py-1.5 text-[13px] font-mono focus:outline-none focus:border-[#1B4FD8]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] mb-1">
                        Payment Mode
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {PAYMENT_MODES.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setMode(option)}
                            className={`px-3 py-1 text-[11.5px] font-semibold rounded border transition-colors cursor-pointer ${
                              mode === option
                                ? "bg-blue-600 text-white border-blue-700 shadow-2xs"
                                : "bg-white text-[#475569] border-[#CBD5E1] hover:border-[#94A3B8]"
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-[#DDE2EC] pt-3">
                      <span className="text-[12px] font-semibold text-[#334155]">Total Amount Due</span>
                      <span className="text-[18px] font-bold text-gray-900 font-mono">
                        ₹{Math.max(0, selected.subtotal - (Number(discount) || 0)).toLocaleString("en-IN")}
                      </span>
                    </div>

                    {collectError && (
                      <p className="text-[11.5px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded">
                        {collectError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={collect}
                      disabled={collecting}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 text-white text-[13px] font-bold cursor-pointer transition-colors shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {collecting ? (
                        <span>Processing Payment…</span>
                      ) : (
                        <span>
                          Collect Payment &amp; Release to {selected.department === "Radiology" ? "Radiology" : "Laboratory"}
                        </span>
                      )}
                    </button>
                    <p className="text-[11px] text-[#94A3B8] text-center">
                      Departmental worklists strictly gate operations until payment is settled by the Cashier.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#DDE2EC] rounded p-6 text-center">
              <p className="text-[12.5px] text-[#94A3B8]">
                Select an investigation order to review and collect payment.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Official Receipt Modal for Both Laboratory & Radiology */}
      {showReceiptModal && (receipt || selected) && (() => {
        const active = receipt || selected!
        const receiptNo =
          active.receiptNo ||
          `RCPT-2026-${(active.invoiceNo || active.id || "").replace(/\D/g, "").slice(-4) || "5501"}`
        const total = active.total || active.subtotal || 0

        const claimObj: ClaimRecord = {
          id: `CLM-${active.id}`,
          invoiceNo: active.invoiceNo || `INV-${active.department === "Radiology" ? "RAD" : "LAB"}-${active.id.replace(/\D/g, "").slice(-5) || "5501"}`,
          patientId: active.umr,
          patientName: active.patientName,
          mrn: active.umr,
          age: active.age || 35,
          gender: active.sex === "Female" ? "Female" : "Male",
          phone: active.phone || "",
          department: active.department as any,
          dateOfService: active.createdAt ? active.createdAt.split("T")[0] : new Date().toISOString().split("T")[0],
          encounterId: active.opNumber || active.encounterId || active.id,
          insuranceProvider: "Self-Pay",
          policyNumber: "N/A",
          status: "Paid",
          items: active.items.map((it, idx) => ({
            id: `ITEM-${it.id || idx}`,
            description: it.name,
            category: active.department === "Radiology" ? "Radiology / Imaging" : "Laboratory",
            cptCode: active.department === "Radiology" ? `RAD-${it.modality || "01"}` : `LAB0${10 + idx}`,
            quantity: 1,
            unitPrice: it.price,
            total: it.price,
            insuranceCovered: 0,
            patientPayable: it.price,
          })),
          subtotal: active.subtotal,
          discount: active.discount || 0,
          tax: 0,
          totalAmount: total,
          insurancePortion: 0,
          patientPortion: total,
          amountPaid: total,
          balanceDue: 0,
          payments: [
            {
              id: `PAY-${active.id}`,
              invoiceId: active.invoiceNo || active.id,
              receiptNo,
              amount: total,
              paymentDate: active.paidAt || new Date().toISOString(),
              paymentMethod: active.mode === "Cash" ? "Cash" : active.mode === "Card" ? "Debit Card" : "UPI / Digital",
              collectedBy: active.collectedBy || collectedBy,
              notes: `${active.department} Investigation Settlement`,
            },
          ],
          diagnosisCodes: ["Z01.89"],
          attendingDoctor: active.doctorName,
          createdAt: active.createdAt || new Date().toISOString(),
          updatedAt: active.paidAt || new Date().toISOString(),
        }

        const paymentObj: PaymentRecord = {
          id: `PAY-${active.id}`,
          invoiceId: active.invoiceNo || active.id,
          receiptNo,
          amount: total,
          paymentDate: active.paidAt || new Date().toISOString(),
          paymentMethod: active.mode === "Cash" ? "Cash" : active.mode === "Card" ? "Debit Card" : "UPI / Digital",
          collectedBy: active.collectedBy || collectedBy,
          notes: `${active.department} Investigation Settlement`,
        }

        return (
          <HospitalReceiptModal
            claim={claimObj}
            payment={paymentObj}
            onClose={() => {
              setShowReceiptModal(false)
              setReceipt(null)
            }}
          />
        )
      })()}
    </div>
  )
}
