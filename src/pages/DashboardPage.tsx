import { useKPIs } from '../hooks/useKPIs'
import { useAlertThresholds } from '../hooks/useAlertThresholds'
import { KPICard } from '../components/dashboard/KPICard'
import { AlertBanner } from '../components/dashboard/AlertBanner'
import { ThresholdEditor } from '../components/dashboard/ThresholdEditor'
import { TrendChart } from '../components/charts/TrendChart'

export function DashboardPage() {
  const kpis = useKPIs()
  const { thresholds, updateThresholds } = useAlertThresholds()

  if (!kpis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 text-sm">Loading KPIs…</div>
      </div>
    )
  }

  const kpiList = [
    { key: 'otif', kpi: kpis.otif },
    { key: 'fillRate', kpi: kpis.fillRate },
    { key: 'orderCycleTime', kpi: kpis.orderCycleTime },
    { key: 'inventoryTurnover', kpi: kpis.inventoryTurnover },
    { key: 'stockOutRate', kpi: kpis.stockOutRate },
    { key: 'avgShippingCost', kpi: kpis.avgShippingCost },
  ] as const

  const chartColors: Record<string, string> = {
    otif: '#22d3ee',
    fillRate: '#34d399',
    orderCycleTime: '#a78bfa',
    inventoryTurnover: '#fb923c',
    stockOutRate: '#f87171',
    avgShippingCost: '#facc15',
  }

  const thresholdMap: Record<string, { value: number; label: string; higherIsBetter: boolean } | undefined> = {
    otif: { value: thresholds.otif_min, label: `Min ${thresholds.otif_min}%`, higherIsBetter: true },
    fillRate: { value: thresholds.fillRate_min, label: `Min ${thresholds.fillRate_min}%`, higherIsBetter: true },
    orderCycleTime: { value: thresholds.cycleTime_max, label: `Max ${thresholds.cycleTime_max}d`, higherIsBetter: false },
    inventoryTurnover: { value: thresholds.inventoryTurnover_min, label: `Min ${thresholds.inventoryTurnover_min}×`, higherIsBetter: true },
    stockOutRate: { value: thresholds.stockOutRate_max, label: `Max ${thresholds.stockOutRate_max}%`, higherIsBetter: false },
    avgShippingCost: { value: thresholds.avgShippingCost_max, label: `Max €${thresholds.avgShippingCost_max}`, higherIsBetter: false },
  }

  return (
    <div className="flex flex-col gap-6">
      <AlertBanner kpis={kpis} thresholds={thresholds} />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">KPI Overview</h2>
        <ThresholdEditor thresholds={thresholds} onUpdate={updateThresholds} />
      </div>

      {/* KPI Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiList.map(({ key, kpi }) => (
          <KPICard key={key} kpi={kpi} thresholds={thresholds} kpiKey={key} />
        ))}
      </div>

      {/* Trend Charts */}
      <h2 className="text-lg font-semibold text-slate-200 mt-2">Monthly Trends</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {kpiList.map(({ key, kpi }) => {
          const t = thresholdMap[key]
          return (
            <TrendChart
              key={key}
              data={kpi.trend}
              label={kpi.label}
              unit={kpi.unit}
              color={chartColors[key]}
              threshold={t?.value}
              thresholdLabel={t?.label}
              higherIsBetter={t?.higherIsBetter}
            />
          )
        })}
      </div>
    </div>
  )
}
