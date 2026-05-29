import { useKPIs } from '../hooks/useKPIs'
import { ScenarioPanel } from '../components/scenario/ScenarioPanel'

export function ScenarioPage() {
  const kpis = useKPIs()

  if (!kpis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-200">Scenario Simulator</h2>
        <p className="text-sm text-slate-500 mt-1">
          Adjust supply chain parameters and see their estimated impact on KPIs.
          Results are simulated — no data is written to the database.
        </p>
      </div>
      <ScenarioPanel baseKPIs={kpis} />
    </div>
  )
}
