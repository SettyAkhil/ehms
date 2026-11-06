import React, { useState, useEffect, useMemo } from "react"
import {
  BookOpen,
  Search,
  Filter,
  DollarSign,
  Clock,
  Layers,
  ChevronRight,
  Eye,
  CheckCircle2,
  X,
  Plus,
} from "lucide-react"
import { findTestDefinition, type LabTestDefinition } from "./labCatalogueSchema"
import {
  DiagnosticTariffDatabase,
  type DiagnosticTariffItem,
} from "../../services/diagnosticTariffDb"

export default function TestMasterView() {
  const [tariffs, setTariffs] = useState<DiagnosticTariffItem[]>(() =>
    DiagnosticTariffDatabase.getTariffs().filter(
      (t) => t.category === "Laboratory" || t.department === "Laboratory"
    )
  )

  useEffect(() => {
    const unsub = DiagnosticTariffDatabase.onUpdate(() => {
      setTariffs(
        DiagnosticTariffDatabase.getTariffs().filter(
          (t) => t.category === "Laboratory" || t.department === "Laboratory"
        )
      )
    })
    return unsub
  }, [])

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("All")
  const [selectedTestDetail, setSelectedTestDetail] = useState<{
    tariff: DiagnosticTariffItem
    definition?: LabTestDefinition
  } | null>(null)

  const categories = useMemo(() => {
    const set = new Set<string>()
    tariffs.forEach((t) => {
      if (t.subCategory) set.add(t.subCategory)
      else if (t.department) set.add(t.department)
    })
    return ["All", ...Array.from(set)]
  }, [tariffs])

  const filteredTariffs = useMemo(() => {
    return tariffs.filter((t) => {
      const matchSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.subCategory && t.subCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.department && t.department.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchCat =
        selectedCategory === "All" ||
        t.subCategory === selectedCategory ||
        t.department === selectedCategory

      return matchSearch && matchCat
    })
  }, [tariffs, searchQuery, selectedCategory])

  return (
    <div className="space-y-4">
      {/* ── TOP BANNER ──────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-100 text-[#7552B8] rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Laboratory Diagnostic Test Master & Tariff Card</h3>
            <p className="text-[11px] text-slate-500">
              Catalog of {tariffs.length} clinical investigation{tariffs.length === 1 ? "" : "s"} configured dynamically by the Administrative Department
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by test name, code, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-xl focus:outline-none w-64"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-[#E2E8F0] rounded-xl text-slate-700 focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? `All Departments (${tariffs.length})` : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── TEST CATALOG TABLE ──────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Test Code</th>
                <th className="py-3 px-4">Investigation Name</th>
                <th className="py-3 px-4">Department Category</th>
                <th className="py-3 px-4">Sub-Module</th>
                <th className="py-3 px-4">Parameters</th>
                <th className="py-3 px-4">Tariff Price</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTariffs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    <BookOpen className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="font-bold text-sm text-slate-700">No Laboratory Investigations Configured Yet</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                      Laboratory diagnostic tests and tariff rate cards are dynamically managed by the Administrative Department. Add investigations in <strong className="text-slate-600">Administration → Diagnostic Tariffs & Price Master</strong> to populate the active laboratory master.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTariffs.slice(0, 50).map((t) => {
                  const schemaDef = findTestDefinition(t.name) || findTestDefinition(t.code)
                  return (
                    <tr key={t.id || t.code + t.name} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-purple-700">{t.code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{t.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-700">
                          {t.department || t.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{t.subCategory || "General"}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {schemaDef?.parameters?.length ? `${schemaDef.parameters.length} parameter(s)` : t.tat || "Standard"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">₹{t.price}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedTestDetail({ tariff: t, definition: schemaDef })}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-[#7552B8] hover:text-white text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{schemaDef?.parameters?.length ? "Parameters" : "Details"}</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-[#E2E8F0] bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{Math.min(50, filteredTariffs.length)}</strong> of{" "}
            <strong className="text-slate-800">{filteredTariffs.length}</strong> cataloged diagnostic investigations
          </span>
          <span className="text-[11px] text-slate-400">Dynamic Rate Card (Administrative Department)</span>
        </div>
      </div>

      {/* ── PARAMETER / DETAIL MODAL ────────────────────────────────────────── */}
      {selectedTestDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{selectedTestDetail.tariff.name}</h4>
                <div className="text-[11px] text-slate-500">
                  Code: <span className="font-mono text-purple-700 font-bold">{selectedTestDetail.tariff.code}</span> · Tariff: ₹{selectedTestDetail.tariff.price}
                </div>
              </div>
              <button
                onClick={() => setSelectedTestDetail(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedTestDetail.definition?.parameters && selectedTestDetail.definition.parameters.length > 0 ? (
              <div className="space-y-2 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Configured Biological Parameters & Ranges
                </span>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="py-2 px-3">Parameter</th>
                        <th className="py-2 px-3">Input Type</th>
                        <th className="py-2 px-3">Unit</th>
                        <th className="py-2 px-3">Normal Reference Interval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTestDetail.definition.parameters.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-semibold text-slate-800">{p.name}</td>
                          <td className="py-2 px-3 font-mono text-slate-500 text-[10.5px]">{p.inputType}</td>
                          <td className="py-2 px-3 font-mono text-slate-700">{p.unit || "-"}</td>
                          <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">
                            {p.referenceRange
                              ? p.referenceRange.low !== undefined && p.referenceRange.high !== undefined
                                ? `${p.referenceRange.low} - ${p.referenceRange.high}`
                                : p.referenceRange.text || "Normal"
                              : "Normal"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[10.5px] uppercase">Department</span>
                    <span className="font-bold text-slate-800">{selectedTestDetail.tariff.department || "Laboratory"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px] uppercase">Sub-Category</span>
                    <span className="font-bold text-slate-800">{selectedTestDetail.tariff.subCategory || "General"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px] uppercase">Standard TAT</span>
                    <span className="font-bold text-slate-800">{selectedTestDetail.tariff.tat || "Within 4 Hours"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10.5px] uppercase">Availability</span>
                    <span className="font-bold text-emerald-700">{selectedTestDetail.tariff.hospitalAvailability || "Enabled"}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 italic">
                  This investigation is dynamically configured in Administration → Diagnostic Tariffs & Price Master.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedTestDetail(null)}
                className="px-4 py-1.5 bg-[#7552B8] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
