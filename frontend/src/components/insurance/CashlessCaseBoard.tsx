import React, { useMemo, useState } from "react"
import {
  Search, Filter, Grid, List, ChevronRight, Clock, FileText,
  Upload, Shield, AlertTriangle, CheckCircle2, MoreVertical,
  Users, Building2, Bed, Calendar, TrendingUp
} from "lucide-react"
import { StatusPill, inr, fmtDate, useCases, btn } from "./ui"
import { InsuranceEngineService, STATUS_META } from "../../services/insuranceDb"
import type { ComprehensiveClaimRecord, InsuranceClaimStatus } from "../../types/insurance"

// Insurer logo chip
function InsurerBadge({ name }: { name: string }) {
  const abbr = name.slice(0, 4).toUpperCase()
  const colors: Record<string, string> = {
    "Star": "bg-red-600 text-white",
    "Care": "bg-amber-400 text-blue-950",
    "HDFC": "bg-rose-700 text-white",
    "Niva": "bg-blue-600 text-white",
    "Adit": "bg-amber-600 text-white",
  }
  const colorKey = Object.keys(colors).find(k => name.startsWith(k)) ?? ""
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-black ${colors[colorKey] || "bg-slate-200 text-slate-700"}`}>
      {abbr}
    </span>
  )
}

// Utilisation bar
function UtilBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-[10px] font-bold tabular-nums whitespace-nowrap ${pct >= 80 ? "text-rose-600" : "text-slate-600"}`}>
        {Math.round(pct)}%
      </span>
    </div>
  )
}

// Stage filter tabs
const STAGES: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "preauth", label: "Pre-Auth" },
  { key: "admitted", label: "Admitted" },
  { key: "discharge", label: "Discharge" },
  { key: "claim", label: "Claim" },
  { key: "settled", label: "Settled" },
  { key: "docs_missing", label: "Docs Missing" },
  { key: "limit_80", label: "> 80% Limit" },
]

export default function CashlessCaseBoard({
  onOpenCase,
  onOpenIntake,
}: {
  onOpenCase: (id: string) => void
  onOpenIntake: () => void
}) {
  const cases = useCases()
  const [tab, setTab] = useState("all")
  const [q, setQ] = useState("")
  const [insurerFilter, setInsurerFilter] = useState("")
  const [wardFilter, setWardFilter] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "card">("table")

  const insurers = useMemo(() => {
    const set = new Set<string>()
    cases.forEach(c => {
      if (c.policy?.insurerName) set.add(c.policy.insurerName)
    })
    return Array.from(set)
  }, [cases])

  const displayCases = useMemo(() => {
    return cases.filter(c => {
      if (q) {
        const t = q.toLowerCase()
        if (!c.patientName.toLowerCase().includes(t) && !c.patientId.toLowerCase().includes(t) && !c.id.toLowerCase().includes(t)) return false
      }
      if (insurerFilter && c.policy.insurerName !== insurerFilter) return false
      if (tab === "preauth" && !c.status.startsWith("PREAUTH")) return false
      if (tab === "admitted" && c.status !== "TREATMENT_IN_PROGRESS" && c.status !== "PREAUTH_APPROVED") return false
      if (tab === "discharge" && c.status !== "DISCHARGE_INITIATED" && c.status !== "FINAL_BILL_READY") return false
      if (tab === "claim" && c.status !== "CLAIM_SUBMITTED" && c.status !== "CLAIM_QUERY_RAISED") return false
      if (tab === "settled" && c.status !== "SETTLEMENT_PENDING" && c.status !== "RECONCILED" && c.status !== "CLOSED") return false
      if (tab === "docs_missing") {
        const docs = c.documents?.filter((d: any) => d.status === "Uploaded" || d.status === "Verified" || d.status === "uploaded" || d.status === "verified").length ?? 0
        if (docs >= 11) return false
      }
      if (tab === "limit_80") {
        const pct = c.approvedPreAuthAmount > 0 ? (c.consumedBillAmount / c.approvedPreAuthAmount) * 100 : 0
        if (pct < 80) return false
      }
      return true
    })
  }, [cases, q, insurerFilter, tab])

  // Tab counts
  const counts = useMemo(() => {
    const preauthPending = cases.filter((c) => c.status?.startsWith("PREAUTH")).length
    const limit80 = cases.filter((c) => c.approvedPreAuthAmount > 0 && (c.consumedBillAmount / c.approvedPreAuthAmount) > 0.8).length
    const docsMissing = cases.filter((c) => (c.documents?.filter((d: any) => d.status === "uploaded" || d.status === "verified").length ?? 0) < 11).length

    return { preauthPending, limit80, docsMissing, total: cases.length }
  }, [cases])

  const admDays = (date: string) => {
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
    return `Day ${d + 1}`
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/70 overflow-y-auto">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mb-1">
            <Shield size={13} /> Insurance &rsaquo; Cashless Case Board
          </div>
          <h1 className="text-xl font-bold text-slate-900">Cashless Case Board</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live digital whiteboard — {counts.total} active insurance cases</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setViewMode(viewMode === "table" ? "card" : "table")} className={btn.soft}>
            {viewMode === "table" ? <><Grid size={13} /> Card view</> : <><List size={13} /> Table view</>}
          </button>
          <button type="button" onClick={onOpenIntake} className={`${btn.primary} gap-1.5`}>
            <Upload size={14} /> New Intake
          </button>
        </div>
      </header>

      {/* Filter bar */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search patient, MRN, case ID…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full pl-8 pr-3 h-8 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-blue-400 outline-none"
          />
        </div>
        <select value={insurerFilter} onChange={e => setInsurerFilter(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none">
          <option value="">All insurers</option>
          {insurers.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={wardFilter} onChange={e => setWardFilter(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none">
          <option value="">All wards</option>
          <option value="ICU">ICU</option>
          <option value="General Ward">General Ward</option>
          <option value="Semi-Private">Semi-Private</option>
          <option value="Private">Private AC</option>
        </select>
      </div>

      {/* Stage tabs */}
      <div className="bg-white border-b border-slate-100 px-6 py-2 flex gap-1 overflow-x-auto">
        {STAGES.map(s => {
          const count = s.key === "all" ? counts.total : s.key === "docs_missing" ? counts.docsMissing : s.key === "limit_80" ? counts.limit80 : s.key === "preauth" ? counts.preauthPending : undefined
          const alert = (s.key === "docs_missing" && counts.docsMissing > 0) || (s.key === "limit_80" && counts.limit80 > 0)
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              className={`h-8 px-3 rounded-md text-[11.5px] font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                tab === s.key ? "bg-blue-600 text-white" : alert ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {s.label}
              {count !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === s.key ? "bg-blue-700 text-white" : alert ? "bg-rose-200 text-rose-800" : "bg-slate-100 text-slate-600"}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10.5px]">
                <th className="px-4 py-3 text-left">Patient / MRN</th>
                <th className="px-4 py-3 text-left">Insurer</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Bed / Ward</th>
                <th className="px-4 py-3 text-left">Admitted</th>
                <th className="px-4 py-3 text-right">Approved</th>
                <th className="px-4 py-3 text-right">Billed</th>
                <th className="px-4 py-3">Utilisation</th>
                <th className="px-4 py-3 text-center">Docs</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayCases.map((row, i) => {
                const approvedAmt = row.approvedPreAuthAmount || 0
                const billedAmt = row.consumedBillAmount || 0
                const docsCount = row.documents?.filter((d: any) => d.status === "Uploaded" || d.status === "Verified").length ?? 0
                const pct = approvedAmt > 0 ? (billedAmt / approvedAmt) * 100 : 0
                const status = row.status
                const admDate = row.admissionDate || row.createdAt

                return (
                  <tr
                    key={row.id || i}
                    className="hover:bg-blue-50/30 cursor-pointer group"
                    onClick={() => onOpenCase(row.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 group-hover:text-blue-700">{row.patientName}</div>
                      <div className="text-slate-400 font-mono text-[10px]">{row.mrn || row.patientId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <InsurerBadge name={row.policy?.insurerName || "Insurance"} />
                        <span className="text-slate-600 text-[11px] truncate max-w-[110px]">{row.policy?.insurerName || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.encounterType || row.department || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{fmtDate(admDate)}</div>
                      <div className="text-slate-400 text-[10px]">{admDays(admDate)}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                      {approvedAmt > 0 ? inr(approvedAmt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {billedAmt > 0 ? inr(billedAmt) : "—"}
                    </td>
                    <td className="px-4 py-3 w-28">
                      {approvedAmt > 0 && billedAmt > 0 ? (
                        <UtilBar pct={pct} />
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold text-[10.5px] ${docsCount >= 11 ? "text-emerald-600" : docsCount < 7 ? "text-rose-600" : "text-amber-700"}`}>
                        {docsCount}/11
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onOpenCase(row.id) }}
                          className="h-6 px-2 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[10px] border border-blue-200"
                        >
                          Open
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {displayCases.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-slate-400 text-xs">
                    <p className="font-bold text-slate-700 text-sm mb-1">No Active Cashless Insurance Cases</p>
                    <p className="text-slate-400">Cases opened from inpatient admissions or created via Insurance Intake appear dynamically here.</p>
                  </td>
                </tr>
              )}
            </tbody>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
