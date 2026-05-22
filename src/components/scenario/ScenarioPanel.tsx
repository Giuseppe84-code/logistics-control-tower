import { useState } from 'react'
import type { KPISnapshot, ScenarioParams } from '../../types'
import { applyScenario } from '../../lib/scenario'

interface ScenarioPanelProps {
  baseKPIs: KPISnapshot
}

function DeltaRow({
  label,
  base,
  scenario,
  unit,
  higherIsBetter = true,
}: {
  label: string
  base: number
  scenario: number
  unit: string
  higherIsBetter?: boolean
}) {
  const delta = scenario - base
  const isPositive = higherIsBetter ? delta > 0 : delta < 0
  const isNegative = higherIsBetter ? delta < 0 : delta > 0

  function fmt(v: number) {
    if (unit === '€') return `€${v.toFixed(2)}`
    if (unit === '%') return `${v.toFixed(1)}%`
    if (unit === 'x/yr') return `${v.toFixed(1)}×`
    return `${v.toFixed(1)}`
  }

  return (
    <tr className="border-b border-slate-700/50">
      <td className="px-4 py-3 text-slate-300">{label}</td>
      <td className="px-4 py-3 text-slate-400 text-right">{fmt(base)}</td>
      <td className="px-4 py-3 text-right font-semibold">
        <span className={isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-slate-300'}>
          {fmt(scenario)}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-xs">
        <span className={isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-slate-500'}>
          {delta > 0 ? '+' : ''}{fmt(delta)}
        </span>
      </td>
    </tr>
  )
}

export function ScenarioPanel({ baseKPIs }: ScenarioPanelProps) {
  const [params, setParams] = useState<ScenarioParams>({
    demandDelta: 0,
    shippingCostDelta: 0,
    supplierReliabilityDelta: 0,
  })

  const impact = applyScenario(baseKPIs, params)

  function SliderField({
    label,
    field,
    hint,
  }: {
    label: string
    field: keyof ScenarioParams
    hint: string
  }) {
    const value = params[field]
    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <label className="text-sm text-slate-300">{label}</label>
          <span className={`text-sm font-bold tabular-nums ${value > 0 ? 'text-amber-400' : value < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {value > 0 ? '+' : ''}{value}%
          </span>
        </div>
        <input
          type="range"
          min={-50}
          max={50}
          step={5}
          value={value}
          onChange={e => setParams(p => ({ ...p, [field]: parseInt(e.target.value) }))}
          className="w-full accent-blue-500"
        />
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
    )
  }

  const hasChanges = params.demandDelta !== 0 || params.shippingCostDelta !== 0 || params.supplierReliabilityDelta !== 0

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-base font-semibold text-slate-200 mb-1">Scenario Parameters</h3>
        <p className="text-xs text-slate-500 mb-6">Adjust parameters to see estimated KPI impact. Changes are not saved to the database.</p>

        <div className="flex flex-col gap-6">
          <SliderField
            label="Customer Demand"
            field="demandDelta"
            hint="Simulates a demand surge or drop. +20% demand → higher fill rate pressure and stock-out risk."
          />
          <SliderField
            label="Shipping Cost"
            field="shippingCostDelta"
            hint="Models carrier rate changes or route optimization. Directly impacts avg cost per shipment."
          />
          <SliderField
            label="Supplier Reliability"
            field="supplierReliabilityDelta"
            hint="Simulates supplier disruptions or improvements. Negative values → more late deliveries → lower OTIF."
          />
        </div>

        <button
          onClick={() => setParams({ demandDelta: 0, shippingCostDelta: 0, supplierReliabilityDelta: 0 })}
          className="mt-6 text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2"
        >
          Reset to baseline
        </button>
      </div>

      {/* Impact table */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-200">Estimated Impact</h3>
          {hasChanges && (
            <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              Scenario active
            </span>
          )}
          {!hasChanges && (
            <span className="text-xs text-slate-500">Showing baseline</span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="text-left px-4 py-2.5 text-slate-400 font-medium">KPI</th>
              <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Baseline</th>
              <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Scenario</th>
              <th className="text-right px-4 py-2.5 text-slate-400 font-medium">Delta</th>
            </tr>
          </thead>
          <tbody>
            <DeltaRow label="OTIF" base={baseKPIs.otif.value} scenario={impact.otif} unit="%" higherIsBetter />
            <DeltaRow label="Fill Rate" base={baseKPIs.fillRate.value} scenario={impact.fillRate} unit="%" higherIsBetter />
            <DeltaRow label="Stock-out Rate" base={baseKPIs.stockOutRate.value} scenario={impact.stockOutRate} unit="%" higherIsBetter={false} />
            <DeltaRow label="Avg Shipping Cost" base={baseKPIs.avgShippingCost.value} scenario={impact.avgShippingCost} unit="€" higherIsBetter={false} />
            <DeltaRow label="Inventory Turnover" base={baseKPIs.inventoryTurnover.value} scenario={impact.inventoryTurnover} unit="x/yr" higherIsBetter />
          </tbody>
        </table>
      </div>
    </div>
  )
}
