/**
 * Diagnostic Tariff & Price Master Database Service.
 * Imperial Hospitals & Research Institute - Standard Diagnostic Rate Card.
 * Manages Laboratory and Radiology (X-Ray, CT Scan, Ultrasound/USG, Echocardiography) investigation tariffs.
 * Persists in LocalStorage with BroadcastChannel fan-out across browser tabs.
 */

import { INITIAL_RADIOLOGY_TARIFFS, RADIOLOGY_MODALITIES } from "./radiologyTariffsData"
export { RADIOLOGY_MODALITIES }

export type DiagnosticDepartment =
  | "Laboratory"
  | "Radiology"
  | "X-Ray"
  | "CT Scan"
  | "MRI"
  | "Ultrasound (USG)"
  | "Doppler"
  | "Mammography"
  | "Fluoroscopy / Contrast"
  | "Nuclear Medicine"
  | "DEXA"
  | "Dental"
  | "Interventional Radiology"
  | "Echocardiography"

export interface DiagnosticTariffItem {
  id: string
  code: string
  name: string
  category: "Laboratory" | "Radiology"
  department: DiagnosticDepartment
  modality?: string
  bodyRegion?: string
  subCategory: string
  variantProtocol?: string
  hospitalAvailability?: "Enabled" | "Unavailable" | "Referred Externally" | string
  tariffReference?: string
  price: number
  responsibleInCharge?: string
  reportTemplate?: string
  tat?: string
  unit?: string
  roomOrDept?: string
  aliases?: string[]
  lastUpdated?: string
}

const STORAGE_KEY_DIAGNOSTIC_TARIFFS = "hospai_diagnostic_tariffs_v5"
const BROADCAST_CHANNEL = "hospai_diagnostic_tariffs"

// ── 1. LABORATORY INVESTIGATIONS (184 Tests from Imperial Rate Card) ────────
export const INITIAL_LAB_TARIFFS: Omit<DiagnosticTariffItem, "id">[] = []

// ── 2. RADIOLOGY INVESTIGATIONS (173 Examinations Across 11 Clinical Modalities) ─
// Legacy arrays mapped to the new clinical catalogue for backward compatibility:
export const INITIAL_XRAY_TARIFFS = INITIAL_RADIOLOGY_TARIFFS.filter((t) => t.department === "X-Ray")
export const INITIAL_CT_TARIFFS = INITIAL_RADIOLOGY_TARIFFS.filter((t) => t.department === "CT Scan")
export const INITIAL_USG_TARIFFS = INITIAL_RADIOLOGY_TARIFFS.filter((t) => t.department === "Ultrasound (USG)")
export const INITIAL_ECHO_TARIFFS = INITIAL_RADIOLOGY_TARIFFS.filter(
  (t) => t.department === "Echocardiography" || t.department === "Doppler"
)

export { INITIAL_RADIOLOGY_TARIFFS }

// ── FULL 357 DIAGNOSTIC TARIFF RATE CARD (184 Laboratory + 173 Radiology) ──────
export const INITIAL_DIAGNOSTIC_TARIFFS: Omit<DiagnosticTariffItem, "id">[] = [
  ...INITIAL_LAB_TARIFFS,
  ...INITIAL_RADIOLOGY_TARIFFS,
]

export class DiagnosticTariffDatabase {
  private static listeners: Set<() => void> = new Set()

  private static load(): DiagnosticTariffItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DIAGNOSTIC_TARIFFS)
      if (raw) {
        const parsed: DiagnosticTariffItem[] = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          return parsed
        }
      }
    } catch {}

    // Seed defaults across all 5 departments (261 items)
    const seeded = INITIAL_DIAGNOSTIC_TARIFFS.map((t) => ({
      ...t,
      id: t.code,
      department: t.department || (t.category === "Laboratory" ? "Laboratory" : "X-Ray"),
      tat: t.tat || "2 Hours",
      lastUpdated: new Date().toISOString().split("T")[0],
    }))
    this.save(seeded)
    return seeded
  }

  private static save(items: DiagnosticTariffItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_DIAGNOSTIC_TARIFFS, JSON.stringify(items))
      this.notify()
    } catch {}
  }

  private static notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn()
      } catch {}
    })
    try {
      const ch = new BroadcastChannel(BROADCAST_CHANNEL)
      ch.postMessage("updated")
      ch.close()
    } catch {}
  }

  static onUpdate(callback: () => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  static getAllTariffs(): DiagnosticTariffItem[] {
    return this.load()
  }

  static getTariffs(): DiagnosticTariffItem[] {
    return this.load()
  }

  static getLabTariffs(): DiagnosticTariffItem[] {
    return this.load().filter((t) => t.category === "Laboratory" || t.department === "Laboratory")
  }

  static getRadiologyTariffs(): DiagnosticTariffItem[] {
    return this.load().filter((t) => t.category === "Radiology" || t.department !== "Laboratory")
  }

  static getDepartmentTariffs(dept: DiagnosticDepartment): DiagnosticTariffItem[] {
    return this.load().filter((t) => t.department === dept)
  }

  static getTariffPriceByName(nameOrCode: string): number | null {
    if (!nameOrCode) return null
    const items = this.load()
    const rawQ = nameOrCode.trim()
    const q = rawQ.toLowerCase().replace(/\s*\([^\)]*\)/g, "").trim()

    // 1. Direct ID or Code match
    const byCode = items.find(
      (i) => i.code.toLowerCase() === rawQ.toLowerCase() || i.id.toLowerCase() === rawQ.toLowerCase(),
    )
    if (byCode) return byCode.price

    // 2. Exact name match
    const byName = items.find(
      (i) => i.name.toLowerCase() === rawQ.toLowerCase() || i.name.toLowerCase() === q,
    )
    if (byName) return byName.price

    // 3. Alias match
    const byAlias = items.find(
      (i) =>
        i.aliases &&
        i.aliases.some(
          (a) => a.toLowerCase() === rawQ.toLowerCase() || a.toLowerCase() === q,
        ),
    )
    if (byAlias) return byAlias.price

    // 4. Substring / parenthetical match
    const matched = items.find((i) => {
      const itemLow = i.name.toLowerCase()
      const itemClean = itemLow.replace(/\s*\([^\)]*\)/g, "").trim()
      return (
        itemLow === q ||
        itemClean === q ||
        rawQ.toLowerCase().includes(itemLow) ||
        rawQ.toLowerCase().includes(itemClean) ||
        itemLow.includes(q) ||
        itemClean.includes(q)
      )
    })
    if (matched) return matched.price

    return null
  }

  static getRadiologyModalities(): readonly string[] {
    return RADIOLOGY_MODALITIES
  }

  static getTariffsByModality(modality: string): DiagnosticTariffItem[] {
    const q = modality.toLowerCase()
    return this.load().filter(
      (t) =>
        (t.modality && t.modality.toLowerCase() === q) ||
        (t.department && t.department.toLowerCase() === q),
    )
  }

  static updateTariffPrice(idOrCode: string, newPrice: number): DiagnosticTariffItem | null {
    const items = this.load()
    const idx = items.findIndex((i) => i.id === idOrCode || i.code === idOrCode)
    if (idx === -1) return null

    items[idx] = {
      ...items[idx],
      price: newPrice,
      lastUpdated: new Date().toISOString().split("T")[0],
    }
    this.save(items)
    return items[idx]
  }

  static updateTariffItem(idOrCode: string, updates: Partial<DiagnosticTariffItem>): DiagnosticTariffItem | null {
    const items = this.load()
    const idx = items.findIndex((i) => i.id === idOrCode || i.code === idOrCode)
    if (idx === -1) return null

    items[idx] = {
      ...items[idx],
      ...updates,
      lastUpdated: new Date().toISOString().split("T")[0],
    }
    this.save(items)
    return items[idx]
  }

  static addTariffItem(item: Omit<DiagnosticTariffItem, "id"> & { id?: string }): DiagnosticTariffItem {
    const items = this.load()
    const newId = item.id || item.code || `TEST-${Date.now()}`
    const newItem: DiagnosticTariffItem = {
      ...item,
      id: newId,
      department: item.department || (item.category === "Laboratory" ? "Laboratory" : "X-Ray"),
      tat: item.tat || "2 Hours",
      lastUpdated: new Date().toISOString().split("T")[0],
    }
    items.unshift(newItem)
    this.save(items)
    return newItem
  }

  static deleteTariffItem(idOrCode: string): boolean {
    const items = this.load()
    const filtered = items.filter((i) => i.id !== idOrCode && i.code !== idOrCode)
    if (filtered.length === items.length) return false
    this.save(filtered)
    return true
  }

  static resetToHospitalRateCard(): DiagnosticTariffItem[] {
    const seeded = INITIAL_DIAGNOSTIC_TARIFFS.map((t) => ({
      ...t,
      id: t.code,
      department: t.department || (t.category === "Laboratory" ? "Laboratory" : "X-Ray"),
      tat: t.tat || "2 Hours",
      lastUpdated: new Date().toISOString().split("T")[0],
    }))
    this.save(seeded)
    return seeded
  }
}
