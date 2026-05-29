import type { KPISnapshot, AlertThresholds } from '../../types'

interface Alert {
  label: string
  message: string
}

function getAlerts(kpis: KPISnapshot, t: AlertThresholds): Alert[] {
  const alerts: Alert[] = []
  if (kpis.otif.value < t.otif_min)
    alerts.push({ label: 'OTIF', message: `${kpis.otif.value.toFixed(1)}% — below threshold of ${t.otif_min}%` })
  if (kpis.fillRate.value < t.fillRate_min)
    alerts.push({ label: 'Fill Rate', message: `${kpis.fillRate.value.toFixed(1)}% — below threshold of ${t.fillRate_min}%` })
  if (kpis.orderCycleTime.value > t.cycleTime_max)
    alerts.push({ label: 'Cycle Time', message: `${kpis.orderCycleTime.value.toFixed(1)} days — above max of ${t.cycleTime_max} days` })
  if (kpis.inventoryTurnover.value < t.inventoryTurnover_min)
    alerts.push({ label: 'Inventory Turnover', message: `${kpis.inventoryTurnover.value.toFixed(1)}× — below min of ${t.inventoryTurnover_min}×` })
  if (kpis.stockOutRate.value > t.stockOutRate_max)
    alerts.push({ label: 'Stock-out Rate', message: `${kpis.stockOutRate.value.toFixed(1)}% — above max of ${t.stockOutRate_max}%` })
  if (kpis.avgShippingCost.value > t.avgShippingCost_max)
    alerts.push({ label: 'Avg Shipping Cost', message: `€${kpis.avgShippingCost.value.toFixed(2)} — above max of €${t.avgShippingCost_max}` })
  return alerts
}

interface AlertBannerProps {
  kpis: KPISnapshot
  thresholds: AlertThresholds
}

export function AlertBanner({ kpis, thresholds }: AlertBannerProps) {
  const alerts = getAlerts(kpis, thresholds)
  if (alerts.length === 0) return (
    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-400">
      <span className="font-semibold">All KPIs within target</span>
    </div>
  )

  return (
    <div className="rounded-lg bg-red-950/40 border border-red-500/40 px-4 py-3">
      <p className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wide">
        {alerts.length} KPI{alerts.length > 1 ? 's' : ''} below threshold
      </p>
      <div className="flex flex-wrap gap-2">
        {alerts.map(a => (
          <span key={a.label} className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
            <span className="font-semibold">{a.label}:</span> {a.message}
          </span>
        ))}
      </div>
    </div>
  )
}
