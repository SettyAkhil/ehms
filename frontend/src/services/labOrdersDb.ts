/**
 * Lab order store -- the doctor -> reception/billing -> laboratory hand-off.
 *
 * When a consultation sheet is split, the investigation half lands here as one
 * LabOrder per visit.
 *
 * Billing status (Pending / Paid) is managed by the Billing module.
 * Laboratory status (Pending -> Sample Collected -> Processing -> Result Entered -> Verified -> Completed)
 * is managed by the Laboratory portal.
 */

import { findTestDefinition } from "../components/laboratory/labCatalogueSchema"
import { isRadiologyTest } from "../utils/testClassifier"
import { BillingDatabase } from "./billingDb"
import { dropLegacySeeds, SEED_LAB_ORDERS } from "./legacySeedPurge"
import { DiagnosticTariffDatabase } from "./diagnosticTariffDb"

const ORDERS_KEY = "hospai_lab_orders_v2"
const CHANNEL_NAME = "hospai_lab_orders"

export type LabOrderStatus =
  | "Awaiting Billing"
  | "Billed"
  | "Sample Collected"
  | "In Progress"
  | "Completed"
  | "Cancelled"

export type LabBillingStatus = "Pending" | "Paid" | "Waived" | "Cancelled"

export type LabTestStatus =
  | "Ordered"
  | "Pending"
  | "Sample Collected"
  | "In Progress"
  | "Processing"
  | "Result Entered"
  | "Verified"
  | "Completed"

export interface LabParameterResult {
  value: string
  unit?: string
  referenceRange?: string
  flag?: "H" | "L" | "Critical" | ""
  notes?: string
}

export interface LabOrderTest {
  id: string
  name: string
  category: string
  urgency: "Routine" | "STAT" | string
  price: number
  status: LabTestStatus
  result?: string
  resultUnit?: string
  referenceRange?: string
  flag?: "H" | "L" | "Critical" | ""
  resultedAt?: string
  results?: Record<string, LabParameterResult>
  tableData?: any[]
  clinicalComments?: string
  sampleCollectedAt?: string
  sampleCollector?: string
  technician?: string
  verifier?: string
  verifiedAt?: string
  processingStartedAt?: string
  processingCompletedAt?: string
}

export interface LabOrderEvent {
  at: string
  actor: string
  action: string
  detail?: string
}

export interface LabOrder {
  id: string
  consultationId?: string
  encounterId: string
  umr: string
  patientName: string
  age: number
  sex: string
  phone: string
  opNumber: string
  doctorId: string
  doctorName: string
  department: string
  diagnosis: string
  clinicalNotes?: string
  tests: LabOrderTest[]
  status: LabOrderStatus
  processingStartedAt?: string
  processingCompletedAt?: string
  createdAt: string
  updatedAt: string
  billing: {
    status: LabBillingStatus
    invoiceNo?: string
    subtotal: number
    discount: number
    total: number
    mode?: "Cash" | "Card" | "UPI" | "Insurance" | "Corporate"
    receiptNo?: string
    paidAt?: string
    collectedBy?: string
  }
  history: LabOrderEvent[]
}

/**
 * Hospital rate card. Matched on a normalised substring.
 * Falls back to lab catalogue schema price, then DEFAULT_TEST_PRICE.
 */
const PRICE_BOOK: { match: string; price: number }[] = [
  { match: "complete blood count", price: 740 },
  { match: "cbc", price: 740 },
  { match: "esr", price: 140 },
  { match: "crp", price: 570 },
  { match: "lipid", price: 1250 },
  { match: "liver function", price: 1320 },
  { match: "lft", price: 1320 },
  { match: "renal function", price: 660 },
  { match: "kft", price: 660 },
  { match: "rft", price: 660 },
  { match: "creatinine", price: 260 },
  { match: "urea", price: 260 },
  { match: "electrolyte", price: 1050 },
  { match: "troponin", price: 1000 },
  { match: "d-dimer", price: 2800 },
  { match: "bnp", price: 3450 },
  { match: "hba1c", price: 1120 },
  { match: "blood sugar", price: 80 },
  { match: "glucose", price: 80 },
  { match: "thyroid", price: 1320 },
  { match: "tsh", price: 500 },
  { match: "vitamin", price: 2640 },
  { match: "ferritin", price: 1300 },
  { match: "urine", price: 300 },
  { match: "stool", price: 250 },
  { match: "culture", price: 660 },
  { match: "biopsy", price: 1650 },
  { match: "blood group", price: 170 },
  { match: "serology", price: 800 },
  { match: "dengue", price: 1490 },
  { match: "malaria", price: 300 },
  { match: "hiv", price: 830 },
  { match: "hbsag", price: 660 },
  { match: "x-ray", price: 450 },
  { match: "xray", price: 450 },
  { match: "ultrasound", price: 1400 },
  { match: "usg", price: 1400 },
  { match: "doppler", price: 2200 },
  { match: "mammogram", price: 2500 },
  { match: "ct", price: 4500 },
  { match: "mri", price: 8500 },
  { match: "pet scan", price: 22000 },
  { match: "ecg", price: 300 },
  { match: "echo", price: 2200 },
  { match: "tmt", price: 2800 },
  { match: "treadmill", price: 2800 },
  { match: "holter", price: 3200 },
  { match: "spirometry", price: 900 },
  { match: "pft", price: 900 },
  { match: "eeg", price: 2400 },
]

export const DEFAULT_TEST_PRICE = 500

export function priceForTest(testName: string): number {
  if (!testName) return DEFAULT_TEST_PRICE

  // 1. Check Diagnostic Tariff & Price Master (authoritative hospital rate card)
  const tariffPrice = DiagnosticTariffDatabase.getTariffPriceByName(testName)
  if (tariffPrice !== null && tariffPrice !== undefined) {
    return tariffPrice
  }

  // 2. Check lab catalogue schema
  const def = findTestDefinition(testName)
  if (def && def.price) return def.price

  // 3. Fallback to PRICE_BOOK
  const normalized = (testName || "").toLowerCase()
  const hit = PRICE_BOOK.filter((entry) =>
    normalized.includes(entry.match),
  ).sort((a, b) => b.match.length - a.match.length)[0]
  return hit ? hit.price : DEFAULT_TEST_PRICE
}

// ── Storage plumbing ─────────────────────────────────────────────────────────

const listeners = new Set<() => void>()
let channel: BroadcastChannel | null = null

function ensureChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined")
    return null
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = () => {
      cachedOrders = null
      listeners.forEach((fn) => fn())
    }
  }
  return channel
}

function notify() {
  cachedOrders = null
  listeners.forEach((fn) => fn())
  ensureChannel()?.postMessage("changed")
}

function getBaseTestName(name: string): string {
  if (!name) return ""
  return name
    .trim()
    .toLowerCase()
    .replace(/\s*\([^\)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeOrder(order: LabOrder): LabOrder {
  // Pure laboratory investigations only - strip any auto-injected radiology studies
  let rawTests = [...(order.tests || [])].filter(
    (t) =>
      !t.id?.startsWith("RAD-TEST-") &&
      t.category !== "RADIOLOGY" &&
      !t.name?.toLowerCase().includes("diagnostic imaging study"),
  )

  // Strict deduplication by normalized base test name
  const seenBaseNames = new Set<string>()
  const deduplicatedTests: typeof rawTests = []
  for (const t of rawTests) {
    const base = getBaseTestName(t.name)
    if (!seenBaseNames.has(base)) {
      seenBaseNames.add(base)
      deduplicatedTests.push(t)
    }
  }

  const isUnbilled = !order.billing || order.billing.status !== "Paid"
  const normalizedTests = deduplicatedTests.map((t) => {
    const currentPrice = isUnbilled ? priceForTest(t.name) : t.price
    const status = isUnbilled && (t.status === "Completed" || t.status === "Verified")
      ? "Pending"
      : t.status === "Ordered"
      ? "Pending"
      : t.status
    return {
      ...t,
      price: currentPrice,
      status: status as LabTestStatus,
    }
  })

  const subtotal = isUnbilled
    ? normalizedTests.reduce((sum, t) => sum + t.price, 0)
    : order.billing?.subtotal || 0
  const discount = order.billing?.discount || 0
  const total = isUnbilled ? Math.max(0, subtotal - discount) : order.billing?.total || 0

  const effectiveStatus = isUnbilled && (order.status === "Completed" || order.status === "Sample Collected")
    ? ("Awaiting Billing" as LabOrderStatus)
    : order.status

  return {
    ...order,
    status: effectiveStatus,
    tests: normalizedTests,
    history: order.history || [],
    billing: {
      status: order.billing?.status || "Pending",
      invoiceNo: order.billing?.invoiceNo,
      mode: order.billing?.mode,
      receiptNo: order.billing?.receiptNo,
      paidAt: order.billing?.paidAt,
      collectedBy: order.billing?.collectedBy,
      subtotal,
      discount,
      total,
    },
  }
}

let cachedOrders: LabOrder[] | null = null

export function invalidateLabOrdersCache(): void {
  cachedOrders = null
}

function readOrders(): LabOrder[] {
  if (typeof window === "undefined") return []
  if (cachedOrders) return cachedOrders

  try {
    const raw = window.localStorage.getItem(ORDERS_KEY)
    if (!raw) {
      cachedOrders = []
      return cachedOrders
    }
    const stored = JSON.parse(raw) as LabOrder[]
    // Sample orders older builds seeded into every browser.
    const parsed = dropLegacySeeds(stored, SEED_LAB_ORDERS, (o) => o.id, (o) => o.patientName)
    let mutated = parsed.length !== stored.length
    const sanitized = parsed.map((order) => {
      let orderMutated = false
      let tests = order.tests

      // Strip any injected radiology studies
      const initialTestsCount = tests.length
      tests = tests.filter(
        (t) =>
          !t.id?.startsWith("RAD-TEST-") &&
          t.category !== "RADIOLOGY" &&
          !t.name?.toLowerCase().includes("diagnostic imaging study"),
      )
      if (tests.length !== initialTestsCount) {
        orderMutated = true
      }

      // STRICT BILLING ENFORCEMENT: If billing is not Paid, order CANNOT be Completed or Sample Collected
      const isOrderPaid = order.billing?.status === "Paid"
      if (!isOrderPaid) {
        let hadUnpaidCompleted = false
        tests = tests.map((t) => {
          if (t.status === "Completed" || t.status === "Verified") {
            hadUnpaidCompleted = true
            return {
              ...t,
              status: "Pending" as const,
              result: "",
              resultUnit: "",
              flag: "" as const,
              results: {},
              clinicalComments: "",
              verifier: undefined,
              verifiedAt: undefined,
              processingCompletedAt: undefined,
              resultedAt: undefined,
            }
          }
          return t
        })

        if (hadUnpaidCompleted || order.status === "Completed" || order.status === "Sample Collected") {
          orderMutated = true
          return {
            ...order,
            tests,
            status: "Awaiting Billing" as const,
            processingCompletedAt: undefined,
          }
        }
      }

      const allCompleted =
        isOrderPaid &&
        tests.length > 0 &&
        tests.every((t) => t.status === "Completed" || t.status === "Verified")

      if (allCompleted && order.status !== "Completed") {
        orderMutated = true
        return {
          ...order,
          tests,
          status: "Completed" as const,
        }
      }

      if (orderMutated) {
        mutated = true
        return {
          ...order,
          tests,
          status:
            order.billing?.status === "Paid"
              ? ("Sample Collected" as const)
              : ("Awaiting Billing" as const),
        }
      }
      return order
    })

    if (mutated) {
      try {
        window.localStorage.setItem(ORDERS_KEY, JSON.stringify(sanitized))
      } catch {}
    }

    cachedOrders = sanitized.map(normalizeOrder)
    return cachedOrders
  } catch {
    return []
  }
}

function writeOrders(orders: LabOrder[]): void {
  if (typeof window === "undefined") return
  cachedOrders = orders
  try {
    window.localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  } catch (err) {
    console.error("Lab orders: could not persist", err)
  }
}

/**
 * The next free number after the highest one already issued under `prefix`.
 * Counting orders instead reissued an existing id whenever an order had been
 * removed, so two orders could share one id (and one invoice number).
 */
function nextSequence(prefix: string, ids: (string | undefined)[]): string {
  let max = 0
  for (const id of ids) {
    if (!id || !id.startsWith(`${prefix}-`)) continue
    const n = parseInt(id.slice(prefix.length + 1), 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}-${String(max + 1).padStart(5, "0")}`
}

// ── API ──────────────────────────────────────────────────────────────────────

export class LabOrderDatabase {
  static subscribe(listener: () => void): () => void {
    listeners.add(listener)
    ensureChannel()
    return () => listeners.delete(listener)
  }

  static getOrders(): LabOrder[] {
    return readOrders()
      .filter((o) => o.tests && o.tests.length > 0)
      .sort((a, b) => {
        const timeB = new Date(b.createdAt || (b as any).orderedDate || 0).getTime()
        const timeA = new Date(a.createdAt || (a as any).orderedDate || 0).getTime()
        return timeB - timeA || (b.id || "").localeCompare(a.id || "")
      })
  }

  static resetToCleanDemoData(): void {
    if (typeof window === "undefined") return
    window.localStorage.setItem(ORDERS_KEY, "[]")
    cachedOrders = null
    try {
      window.localStorage.removeItem("hospai_lab_orders_v1")
      window.localStorage.removeItem("hospai_billing_lab_orders_v1")
    } catch {}
    notify()
  }

  static getOrder(id: string): LabOrder | undefined {
    return readOrders().find((o) => o.id === id)
  }

  static getOrdersForPatient(umr: string): LabOrder[] {
    const normalized = umr.toUpperCase()
    return this.getOrders().filter((o) => o.umr.toUpperCase() === normalized)
  }

  /** Reception's queue: ordered by the doctor, not yet paid for. */
  static getBillingQueue(): LabOrder[] {
    return this.getOrders().filter(
      (o) => o.billing.status === "Pending" && o.status !== "Cancelled",
    )
  }

  /**
   * The laboratory's worklist.
   * Returns all active non-cancelled lab orders (both Paid and Pending billing).
   */
  static getLabWorklist(filter?: "all" | "paid" | "pending"): LabOrder[] {
    const orders = this.getOrders().filter((o) => o.status !== "Cancelled")
    if (filter === "paid") {
      return orders.filter((o) => o.billing.status === "Paid")
    }
    if (filter === "pending") {
      return orders.filter((o) => o.billing.status === "Pending")
    }
    return orders
  }

  static createOrder(input: {
    consultationId?: string
    encounterId: string
    umr: string
    patientName: string
    age: number
    sex: string
    phone: string
    opNumber: string
    doctorId: string
    doctorName: string
    department: string
    diagnosis: string
    clinicalNotes?: string
    tests: { name: string; category?: string; urgency?: string }[]
  }): LabOrder {
    const orders = readOrders()
    const now = new Date().toISOString()

    const tests: LabOrderTest[] = input.tests.map((test, index) => {
      const def = findTestDefinition(test.name)
      return {
        id: `LT-${index + 1}`,
        name: def ? def.name : test.name,
        category: def ? def.category : (test.category || "PATHOLOGY"),
        urgency: (test.urgency as LabOrderTest["urgency"]) || "Routine",
        price: priceForTest(test.name),
        status: "Pending",
      }
    })

    const subtotal = tests.reduce((sum, t) => sum + t.price, 0)
    const order: LabOrder = {
      id: nextSequence(`LAB-${new Date().getFullYear()}`, orders.map((o) => o.id)),
      consultationId: input.consultationId,
      encounterId: input.encounterId,
      umr: input.umr,
      patientName: input.patientName,
      age: input.age,
      sex: input.sex,
      phone: input.phone,
      opNumber: input.opNumber,
      doctorId: input.doctorId,
      doctorName: input.doctorName,
      department: input.department,
      diagnosis: input.diagnosis,
      clinicalNotes: input.clinicalNotes,
      tests,
      status: "Awaiting Billing",
      createdAt: now,
      updatedAt: now,
      billing: {
        status: "Pending",
        invoiceNo: nextSequence(`INV-${new Date().getFullYear()}`, orders.map((o) => o.billing?.invoiceNo)),
        subtotal,
        discount: 0,
        total: subtotal,
      },
      history: [
        {
          at: now,
          actor: input.doctorName,
          action: "Ordered",
          detail: `${tests.length} investigation(s) sent to reception for billing`,
        },
      ],
    }

    writeOrders([order, ...orders])
    notify()
    return order
  }

  /**
   * Add a new test manually to an existing lab order.
   */
  static addTestToOrder(
    orderId: string,
    testData: {
      name: string
      category?: string
      urgency?: "Routine" | "Urgent" | "STAT"
      price?: number
      clinicalNotes?: string
    },
    actor: string
  ): LabOrder | undefined {
    return this.mutate(orderId, (order) => {
      const def = findTestDefinition(testData.name)
      const testPrice =
        testData.price !== undefined
          ? testData.price
          : priceForTest(testData.name)
      const newTestId = `LT-${order.tests.length + 1}-${Date.now().toString().slice(-4)}`
      const now = new Date().toISOString()

      const newTest: LabOrderTest = {
        id: newTestId,
        name: def ? def.name : testData.name,
        category: def ? def.category : testData.category || "PATHOLOGY",
        urgency: testData.urgency || "Routine",
        price: testPrice,
        status:
          order.status === "Sample Collected" || order.status === "In Progress"
            ? "Sample Collected"
            : "Pending",
        sampleCollectedAt:
          order.status === "Sample Collected" || order.status === "In Progress"
            ? now
            : undefined,
        sampleCollector:
          order.status === "Sample Collected" || order.status === "In Progress"
            ? actor
            : undefined,
      }

      const updatedTests = [...order.tests, newTest]

      // Re-calculate billing subtotal and total
      const newSubtotal = order.billing.subtotal + testPrice
      const newTotal = order.billing.total + testPrice

      // If the order was Completed, adding a test reopens it to active worklist
      const nextStatus =
        order.status === "Completed"
          ? order.billing.status === "Paid"
            ? "In Progress"
            : "Awaiting Billing"
          : order.status

      return {
        ...order,
        tests: updatedTests,
        status: nextStatus,
        billing: {
          ...order.billing,
          subtotal: newSubtotal,
          total: newTotal,
        },
        history: [
          ...order.history,
          {
            at: now,
            actor,
            action: "Test Added Manually",
            detail: `${newTest.name} added manually to order by ${actor} (₹${testPrice})`,
          },
        ],
      }
    })
  }

  private static mutate(
    id: string,
    mutator: (order: LabOrder) => LabOrder,
  ): LabOrder | undefined {
    const orders = readOrders()
    const index = orders.findIndex((o) => o.id === id)
    if (index < 0) return undefined
    const updated = {
      ...mutator(orders[index]),
      updatedAt: new Date().toISOString(),
    }
    orders[index] = updated
    writeOrders(orders)
    notify()
    return updated
  }

  /** Reception takes payment. Releases order to the laboratory. */
  static markBilled(
    id: string,
    payment: {
      mode: NonNullable<LabOrder["billing"]["mode"]>
      discount?: number
      collectedBy: string
    },
  ): LabOrder | undefined {
    const result = this.mutate(id, (order) => {
      const discount = Math.max(
        0,
        Math.min(payment.discount || 0, order.billing.subtotal),
      )
      const total = order.billing.subtotal - discount
      return {
        ...order,
        status: "Billed",
        billing: {
          ...order.billing,
          status: "Paid",
          discount,
          total,
          mode: payment.mode,
          receiptNo: `RCPT-2026-${Math.floor(5000 + Math.random() * 4999)}`,
          paidAt: new Date().toISOString(),
          collectedBy: payment.collectedBy,
        },
        history: [
          ...order.history,
          {
            at: new Date().toISOString(),
            actor: payment.collectedBy,
            action: "Payment collected",
            detail: `₹${total.toLocaleString("en-IN")} via ${payment.mode} -- payment settled, released to laboratory`,
          },
        ],
      }
    })

    // Sync settled lab claim and payment record to Central Billing
    if (result) {
      try {
        const invoiceNo = result.billing.invoiceNo || `INV-LAB-${result.id.slice(-6)}`
        const receiptNo = result.billing.receiptNo || `REC-LAB-${result.id.slice(-6)}`
        const nowIso = result.billing.paidAt || new Date().toISOString()
        const paidAmount = result.billing.total
        const claimId = `CLM-${result.id}`

        const paymentRecord = {
          id: `PAY-${result.id}-${Date.now().toString().slice(-4)}`,
          invoiceId: invoiceNo,
          receiptNo,
          amount: paidAmount,
          paymentDate: nowIso,
          paymentMethod: (payment.mode === "Cash" ? "Cash" : payment.mode === "UPI" ? "UPI / Digital" : "Credit Card") as any,
          collectedBy: payment.collectedBy,
          notes: "Laboratory Investigation Charges Settled at Lab Desk",
        }

        const claims = BillingDatabase.getClaims()
        const existingClaimIdx = claims.findIndex((c) => c.invoiceNo === invoiceNo || c.id === claimId)
        if (existingClaimIdx >= 0) {
          const c = claims[existingClaimIdx]
          claims[existingClaimIdx] = {
            ...c,
            status: "Paid",
            amountPaid: c.totalAmount,
            balanceDue: 0,
            payments: [...(c.payments || []).filter((p) => p.receiptNo !== receiptNo), paymentRecord],
            updatedAt: nowIso,
          }
          BillingDatabase.saveClaims(claims)
        } else {
          const newClaim: any = {
            id: claimId,
            invoiceNo,
            encounterId: result.encounterId || result.opNumber || result.id,
            patientId: result.umr,
            patientName: result.patientName,
            mrn: result.umr,
            age: result.age,
            gender: result.sex === "Female" ? "Female" : "Male",
            phone: result.phone || "",
            department: "Laboratory",
            dateOfService: result.createdAt ? result.createdAt.split("T")[0] : nowIso.split("T")[0],
            carePathway: "Laboratory Diagnostic Workup",
            insuranceProvider: "Self-Pay",
            policyNumber: "N/A",
            status: "Paid",
            attendingDoctor: result.doctorName || "Treating Physician",
            diagnosisCodes: [result.diagnosis || "Z01.89"],
            items: result.tests.map((t, idx) => ({
              id: `ITEM-${t.id || idx}`,
              description: t.name,
              category: "Laboratory",
              cptCode: `LAB0${10 + idx}`,
              quantity: 1,
              unitPrice: t.price,
              total: t.price,
              insuranceCovered: 0,
              patientPayable: t.price,
            })),
            subtotal: result.billing.subtotal,
            discount: result.billing.discount || 0,
            tax: 0,
            totalAmount: paidAmount,
            insurancePortion: 0,
            patientPortion: paidAmount,
            amountPaid: paidAmount,
            balanceDue: 0,
            payments: [paymentRecord],
            createdAt: result.createdAt || nowIso,
            updatedAt: nowIso,
          }
          BillingDatabase.saveClaims([newClaim, ...claims])
        }
        BillingDatabase.emitUpdate()
      } catch (err) {
        console.warn("Could not sync lab payment to BillingDatabase:", err)
      }
    }

    return result
  }

  static advanceStatus(
    id: string,
    status: LabOrderStatus,
    actor: string,
  ): LabOrder | undefined {
    return this.mutate(id, (order) => {
      // Payment enforcement: Cannot advance sample collection, processing, or completion if unpaid
      if (
        order.billing?.status !== "Paid" &&
        (status === "Sample Collected" || status === "In Progress" || status === "Completed")
      ) {
        console.warn(`[LabOrderDatabase] Blocked advanceStatus to ${status}: Order ${id} is unpaid.`)
        return order
      }

      const now = new Date().toISOString()
      return {
        ...order,
        status,
        processingStartedAt:
          status === "In Progress"
            ? order.processingStartedAt || now
            : order.processingStartedAt,
        processingCompletedAt:
          status === "Completed"
            ? order.processingCompletedAt || now
            : order.processingCompletedAt,
        tests:
          status === "Sample Collected" || status === "In Progress"
            ? order.tests.map((t) =>
                t.status === "Completed" || t.status === "Verified"
                  ? t
                  : {
                      ...t,
                      status: (status === "In Progress" ? "Processing" : status) as LabTestStatus,
                      processingStartedAt:
                        status === "In Progress"
                          ? t.processingStartedAt || now
                          : t.processingStartedAt,
                    },
              )
            : order.tests,
        history: [
          ...order.history,
          { at: now, actor, action: status },
        ],
      }
    })
  }

  /**
   * Update the status of a specific test on an order.
   */
  static updateTestStatus(
    orderId: string,
    testId: string,
    status: LabTestStatus,
    actor: string,
    extra?: { sampleCollector?: string; technician?: string; verifier?: string }
  ): LabOrder | undefined {
    return this.mutate(orderId, (order) => {
      // Payment enforcement: Cannot advance test status on unpaid orders
      if (
        order.billing?.status !== "Paid" &&
        (status === "Processing" ||
          status === "In Progress" ||
          status === "Result Entered" ||
          status === "Completed" ||
          status === "Verified" ||
          status === "Sample Collected")
      ) {
        console.warn(`[LabOrderDatabase] Blocked updateTestStatus to ${status}: Order ${orderId} is unpaid.`)
        return order
      }

      const now = new Date().toISOString()
      const isStartingProcessing = status === "Processing" || status === "In Progress"
      const isCompleting = status === "Verified" || status === "Completed" || status === "Result Entered"
      const tests = order.tests.map((t) => {
        if (t.id !== testId && t.name !== testId) return t
        return {
          ...t,
          status,
          sampleCollectedAt:
            status === "Sample Collected"
              ? (t.sampleCollectedAt || now)
              : t.sampleCollectedAt,
          sampleCollector: extra?.sampleCollector || t.sampleCollector,
          technician: extra?.technician || t.technician,
          processingStartedAt:
            isStartingProcessing
              ? t.processingStartedAt || now
              : t.processingStartedAt,
          processingCompletedAt:
            isCompleting
              ? t.processingCompletedAt || now
              : t.processingCompletedAt,
          verifier: extra?.verifier || t.verifier,
          verifiedAt:
            status === "Verified" || status === "Completed"
              ? now
              : t.verifiedAt,
        }
      })

      const isPaid = order.billing?.status === "Paid"
      const allCompleted =
        isPaid &&
        tests.every(
          (t) => t.status === "Completed" || t.status === "Verified",
        )
      let nextOrderStatus: LabOrderStatus = order.status
      if (allCompleted) {
        nextOrderStatus = "Completed"
      } else if (status === "Sample Collected" && (order.status === "Billed" || isPaid)) {
        nextOrderStatus = "Sample Collected"
      } else if (
        isPaid &&
        (status === "Processing" ||
          status === "Result Entered" ||
          order.status === "Billed")
      ) {
        nextOrderStatus = "In Progress"
      }

      return {
        ...order,
        tests,
        status: nextOrderStatus,
        processingStartedAt:
          isStartingProcessing
            ? order.processingStartedAt || now
            : order.processingStartedAt,
        processingCompletedAt:
          allCompleted
            ? order.processingCompletedAt || now
            : order.processingCompletedAt,
        history: [
          ...order.history,
          {
            at: now,
            actor,
            action: `Test ${status}`,
            detail: `${order.tests.find((t) => t.id === testId)?.name || testId} updated to ${status}`,
          },
        ],
      }
    })
  }

  /**
   * Save detailed test results with parameter values, units, flags, and comments.
   */
  static saveDetailedTestResult(
    orderId: string,
    testId: string,
    data: {
      status: LabTestStatus
      results: Record<string, LabParameterResult>
      tableData?: any[]
      clinicalComments?: string
      technician?: string
      verifier?: string
      actor: string
    }
  ): LabOrder | undefined {
    return this.mutate(orderId, (order) => {
      // Payment enforcement: results can only be entered if patient bill has been paid
      if (order.billing?.status !== "Paid") {
        console.warn(`[LabOrderDatabase] Blocked result entry: Order ${orderId} has unpaid billing status: ${order.billing?.status}`)
        return order
      }

      const now = new Date().toISOString()
      const tests = order.tests.map((t) => {
        if (t.id !== testId && t.name !== testId) return t
        const paramValues = Object.values(data.results)
        const primaryResult = paramValues[0]?.value || ""
        const primaryUnit = paramValues[0]?.unit || ""
        const hasCritical = paramValues.some((r) => r.flag === "Critical")
        const hasHigh = paramValues.some((r) => r.flag === "H")
        const hasLow = paramValues.some((r) => r.flag === "L")
        const flag: LabOrderTest["flag"] = hasCritical ? "Critical" : hasHigh ? "H" : hasLow ? "L" : ""

        const isCompleting = data.status === "Completed" || data.status === "Verified" || data.status === "Result Entered"
        return {
          ...t,
          status: data.status,
          result: primaryResult,
          resultUnit: primaryUnit,
          flag,
          results: data.results,
          tableData: data.tableData,
          clinicalComments: data.clinicalComments,
          technician: data.technician || data.actor,
          resultedAt: t.resultedAt || now,
          processingStartedAt: t.processingStartedAt || t.sampleCollectedAt || now,
          processingCompletedAt:
            isCompleting ? (t.processingCompletedAt || now) : t.processingCompletedAt,
          verifier:
            data.verifier ||
            (data.status === "Verified" || data.status === "Completed"
              ? data.actor
              : undefined),
          verifiedAt:
            data.status === "Verified" || data.status === "Completed"
              ? now
              : t.verifiedAt,
        }
      })

      const allCompleted = tests.every(
        (t) => t.status === "Completed" || t.status === "Verified",
      )
      let nextOrderStatus: LabOrderStatus = order.status
      if (allCompleted) {
        nextOrderStatus = "Completed"
      } else {
        nextOrderStatus = "In Progress"
      }

      return {
        ...order,
        tests,
        status: nextOrderStatus,
        processingStartedAt: order.processingStartedAt || now,
        processingCompletedAt:
          allCompleted ? (order.processingCompletedAt || now) : order.processingCompletedAt,
        history: [
          ...order.history,
          {
            at: now,
            actor: data.actor,
            action: `Results ${data.status}`,
            detail: `${order.tests.find((t) => t.id === testId)?.name || testId} results saved (${data.status})`,
          },
        ],
      }
    })
  }

  /**
   * Import all results: Loads or auto-populates default verified results
   * for all tests on this order.
   */
  static importAllResults(
    orderId: string,
    actor: string,
    verifierName: string = "Dr. Rajesh Gupta, MD (Path)"
  ): LabOrder | undefined {
    return this.mutate(orderId, (order) => {
      // Payment enforcement: Cannot import or enter results on unpaid orders
      if (order.billing?.status !== "Paid") {
        console.warn(`[LabOrderDatabase] Blocked importAllResults: Order ${orderId} is unpaid.`)
        return order
      }

      const now = new Date().toISOString()
      const tests = order.tests.map((t) => {
        const def = findTestDefinition(t.name)
        const results: Record<string, LabParameterResult> = {}
        if (def) {
          def.parameters.forEach((param) => {
            results[param.name] = {
              value: "",
              unit: param.unit || "",
              referenceRange: param.referenceRange?.text || "",
              flag: "",
            }
          })
        } else {
          results[t.name] = {
            value: "",
            unit: "",
            referenceRange: "",
            flag: "",
          }
        }

        const primaryResult = Object.values(results)[0]?.value || ""
        const primaryUnit = Object.values(results)[0]?.unit || ""

        return {
          ...t,
          status: "Completed" as LabTestStatus,
          result: primaryResult,
          resultUnit: primaryUnit,
          flag: "" as LabOrderTest["flag"],
          results,
          clinicalComments: "",
          technician: actor,
          resultedAt: now,
          processingStartedAt: t.processingStartedAt || t.sampleCollectedAt || now,
          processingCompletedAt: t.processingCompletedAt || now,
          verifier: verifierName,
          verifiedAt: now,
        }
      })

      return {
        ...order,
        tests,
        status: "Completed",
        processingStartedAt: order.processingStartedAt || now,
        processingCompletedAt: order.processingCompletedAt || now,
        history: [
          ...order.history,
          {
            at: now,
            actor,
            action: "Import All Test Results",
            detail: `All ${tests.length} tests imported and verified by ${verifierName}`,
          },
        ],
      }
    })
  }

  /**
   * Mark an entire lab order as Completed and Verified.
   */
  static completeOrder(
    orderId: string,
    actor: string,
    verifierName: string = "Dr. Rajesh Gupta, MD (Path)"
  ): LabOrder | undefined {
    return this.mutate(orderId, (order) => {
      // Payment enforcement: Bill must be paid before an order can be completed
      if (order.billing?.status !== "Paid") {
        console.warn(`[LabOrderDatabase] Blocked completeOrder: Order ${orderId} is unpaid (billing: ${order.billing?.status}).`)
        return order
      }

      // Result validation: An order cannot be verified or completed if zero results were entered
      const hasAnyResults = order.tests.some(
        (t) => Boolean(t.result) || (t.results && Object.keys(t.results).length > 0)
      )
      if (!hasAnyResults) {
        console.warn(`[LabOrderDatabase] Blocked completeOrder: Order ${orderId} has no entered test results.`)
        return order
      }

      const now = new Date().toISOString()
      const tests = order.tests.map((t) => ({
        ...t,
        status: "Completed" as LabTestStatus,
        technician: t.technician || actor,
        resultedAt: t.resultedAt || now,
        processingStartedAt: t.processingStartedAt || t.sampleCollectedAt || now,
        processingCompletedAt: t.processingCompletedAt || now,
        verifier: t.verifier || verifierName,
        verifiedAt: t.verifiedAt || now,
      }))

      return {
        ...order,
        tests,
        status: "Completed",
        processingStartedAt: order.processingStartedAt || now,
        processingCompletedAt: order.processingCompletedAt || now,
        history: [
          ...order.history,
          {
            at: now,
            actor,
            action: "Order Completed",
            detail: `Lab order marked as Completed & Verified by ${verifierName}`,
          },
        ],
      }
    })
  }

  static cancelOrder(
    id: string,
    actor: string,
    reason: string,
  ): LabOrder | undefined {
    return this.mutate(id, (order) => ({
      ...order,
      status: "Cancelled",
      billing: {
        ...order.billing,
        status: order.billing.status === "Paid" ? "Paid" : "Cancelled",
      },
      history: [
        ...order.history,
        {
          at: new Date().toISOString(),
          actor,
          action: "Cancelled",
          detail: reason,
        },
      ],
    }))
  }
}
