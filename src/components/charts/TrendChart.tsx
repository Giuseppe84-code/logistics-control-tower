import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { MonthlyPoint } from '../../types'

interface TrendChartProps {
  data: MonthlyPoint[]
  label: string
  unit: string
  color?: string
  threshold?: number
  thresholdLabel?: string
  higherIsBetter?: boolean
}

export function TrendChart({
  data,
  label,
  unit,
  color = '#22d3ee',
  threshold,
  thresholdLabel,
  higherIsBetter = true,
}: TrendChartProps) {
  const enriched = data.map(d => ({
    ...d,
    ...(threshold != null ? { threshold } : {}),
  }))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        {label} <span className="text-slate-500 font-normal">({unit})</span>
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={enriched} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color }}
          />
          {threshold != null && <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />}
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
          />
          {threshold != null && (
            <Line
              type="monotone"
              dataKey="threshold"
              name={thresholdLabel ?? 'Threshold'}
              stroke={higherIsBetter ? '#f87171' : '#fb923c'}
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
