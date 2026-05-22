import type { KPIValue, AlertThresholds } from '../../types'
import { Tooltip } from '../ui/Tooltip'
import { TrendSparkline } from '../charts/TrendSparkline'

interface KPICardProps {
  kpi: KPIValue
  thresholds: AlertThresholds
  kpiKey: string
}

function isAlert(kpiLabel: string, value: number, thresholds: AlertThresholds): boolean {
  if (kpiLabel === 'OTIF') return value < thresholds.otif_min
  if (kpiLabel === 'Fill Rate') return value < thresholds.fillRate_min
  if (kpiLabel === 'Order Cycle Time') return value > thresholds.cycleTime_max
  if (kpiLabel === 'Inventory Turnover') return value < thresholds.inventoryTurnover_min
  if (kpiLabel === 'Stock-out Rate') return value > thresholds.stockOutRate_max
  if (kpiLabel === 'Avg Shipping Cost') return value > thresholds.avgShippingCost_max
  return false
}

function formatValue(value: number, unit: string): string {
  if (unit === '€') return `€${value.toFixed(2)}`
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'days') return `${value.toFixed(1)} days`
  if (unit === 'x/yr') return `${value.toFixed(1)}×`
  return String(value)
}

export function KPICard({ kpi, thresholds, kpiKey: _kpiKey }: KPICardProps) {
  const alert = isAlert(kpi.label, kpi.value, thresholds)

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-3 transition-all ${
      alert
        ? 'bg-red-950/40 border-red-500/50 shadow-red-900/20 shadow-lg'
        : 'bg-slate-800 border-slate-700 hover:border-slate-600'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-400">{kpi.label}</span>
          <Tooltip content={kpi.definition}>
            <span className="cursor-help text-slate-500 hover:text-slate-300 text-xs border border-slate-600 rounded-full w-4 h-4 inline-flex items-center justify-center">
              ?
            </span>
          </Tooltip>
        </div>
        {alert && (
          <span className="text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
            ALERT
          </span>
        )}
      </div>

      <div className={`text-3xl font-bold tracking-tight ${alert ? 'text-red-400' : 'text-slate-100'}`}>
        {formatValue(kpi.value, kpi.unit)}
      </div>

      <TrendSparkline data={kpi.trend} alert={alert} unit={kpi.unit} />
    </div>
  )
}
