import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts'
import type { MonthlyPoint } from '../../types'

interface TrendSparklineProps {
  data: MonthlyPoint[]
  alert: boolean
  unit: string
}

export function TrendSparkline({ data, alert, unit }: TrendSparklineProps) {
  if (data.length === 0) return null

  return (
    <div className="h-14">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: alert ? '#f87171' : '#67e8f9' }}
            formatter={(v: number) => [`${v}${unit === '€' ? '€' : unit === '%' ? '%' : ` ${unit}`}`, '']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={alert ? '#f87171' : '#22d3ee'}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
