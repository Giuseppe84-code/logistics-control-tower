import { useSupplierScores } from '../hooks/useSupplierScores'
import { Badge } from '../components/ui/Badge'
import { toCSV, downloadCSV } from '../lib/csv'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts'

function ratingBadge(onTimeRate: number) {
  if (onTimeRate >= 90) return <Badge variant="success">Excellent</Badge>
  if (onTimeRate >= 80) return <Badge variant="warning">Acceptable</Badge>
  return <Badge variant="danger">At risk</Badge>
}

function barColor(onTimeRate: number): string {
  if (onTimeRate >= 90) return '#34d399'
  if (onTimeRate >= 80) return '#fbbf24'
  return '#f87171'
}

export function SuppliersPage() {
  const scores = useSupplierScores()

  if (!scores) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500 text-sm">Loading suppliers…</div>
      </div>
    )
  }

  function handleExport() {
    const csv = toCSV(scores ?? [], [
      { key: 'name', header: 'Supplier' },
      { key: 'country', header: 'Country' },
      { key: 'leadTimeDays', header: 'Lead Time (days)' },
      { key: 'reliabilityScore', header: 'Reliability Score', get: s => (s.reliabilityScore * 100).toFixed(0) + '%' },
      { key: 'poCount', header: 'POs Received' },
      { key: 'onTimeRate', header: 'On-Time Rate (%)' },
      { key: 'avgDelayDays', header: 'Avg Delay (days)' },
      { key: 'totalSpend', header: 'Total Spend (EUR)' },
    ])
    downloadCSV(`supplier_scorecard_${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  const chartData = scores.map(s => ({ name: s.name, onTimeRate: s.onTimeRate }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-200">Supplier Scorecard</h2>
        <p className="text-sm text-slate-500 mt-1">
          Supplier performance derived from received purchase orders — on-time delivery,
          average delay, lead time and spend. The dashed line marks the 90% on-time target.
        </p>
      </div>

      {/* On-time rate chart */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">On-Time Delivery Rate by Supplier (%)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} angle={-12} textAnchor="end" height={50} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(v: number) => [`${v}%`, 'On-time']}
            />
            <ReferenceLine y={90} stroke="#f87171" strokeDasharray="5 5" />
            <Bar dataKey="onTimeRate" radius={[4, 4, 0, 0]}>
              {chartData.map(d => (
                <Cell key={d.name} fill={barColor(d.onTimeRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scorecard table */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">Performance Detail</h3>
        <button
          onClick={handleExport}
          className="text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-2 transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Supplier</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Country</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Lead Time</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">POs</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">On-Time</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Avg Delay</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Spend</th>
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {scores.map(s => (
              <tr key={s.id} className="bg-slate-900/50 hover:bg-slate-800/80 transition-colors">
                <td className="px-4 py-2.5 text-slate-200 font-medium">{s.name}</td>
                <td className="px-4 py-2.5 text-slate-400">{s.country}</td>
                <td className="px-4 py-2.5 text-right text-slate-300">{s.leadTimeDays} d</td>
                <td className="px-4 py-2.5 text-right text-slate-300">{s.poCount}</td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-200">{s.onTimeRate}%</td>
                <td className="px-4 py-2.5 text-right text-slate-300">{s.avgDelayDays} d</td>
                <td className="px-4 py-2.5 text-right text-slate-300">€{s.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-2.5">{ratingBadge(s.onTimeRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
