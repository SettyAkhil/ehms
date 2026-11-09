import React from "react"
import LabOrdersView from "./LabOrdersView"
import { LabOrder, LabOrderTest } from "../../services/labOrdersDb"

interface LabOrdersAndCollectionViewProps {
  onOpenWorkbench?: (order: LabOrder, test?: LabOrderTest) => void
  onOpenWorklists?: (order: LabOrder) => void
  onOpenReport?: (order: LabOrder) => void
}

export default function LabOrdersAndCollectionView({
  onOpenWorkbench,
  onOpenWorklists,
  onOpenReport,
}: LabOrdersAndCollectionViewProps) {
  return (
    <div className="space-y-4">
      {/* ── UNIFIED ORDERS DIRECTORY WORKSPACE BAR ─────────────────────────── */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-3.5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Lab Orders Directory</h3>
            <p className="text-[11px] text-slate-500">Doctor order intake, billing clearance verification, and direct analytical routing</p>
          </div>

          <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-2">
            <span className="font-semibold text-slate-700">Direct Workflow:</span>
            <span>Billing Clearance → Draw Sample → Direct Department Analytical Worklists</span>
          </div>
        </div>
      </div>

      {/* ── ACTIVE PANEL RENDERING ─────────────────────────────────────────── */}
      <div className="transition-all">
        <LabOrdersView
          onOpenBench={(ord) => {
            if (onOpenWorkbench) onOpenWorkbench(ord)
          }}
          onOpenWorklists={(ord) => {
            if (onOpenWorklists) onOpenWorklists(ord)
            else if (onOpenWorkbench) onOpenWorkbench(ord)
          }}
          onOpenReport={(ord) => {
            if (onOpenReport) onOpenReport(ord)
          }}
        />
      </div>
    </div>
  )
}
