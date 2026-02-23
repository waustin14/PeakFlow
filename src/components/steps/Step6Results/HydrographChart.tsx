import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useUIStore } from '@/store/useUIStore'
import type { TR55Results } from '@/types/results'
import type { ReturnPeriod } from '@/types/project'

const PERIOD_COLORS: Record<ReturnPeriod, string> = {
  1: '#94a3b8',
  2: '#22d3ee',
  5: '#34d399',
  10: '#fbbf24',
  25: '#f97316',
  50: '#ef4444',
  100: '#a855f7',
}

interface HydrographChartProps {
  results: TR55Results
}

export function HydrographChart({ results }: HydrographChartProps) {
  const theme = useUIStore((s) => s.theme)
  const isDark = theme === 'dark'

  const gridColor = isDark ? '#3f3f46' : '#e4e4e7'
  const axisColor = isDark ? '#71717a' : '#a1a1aa'
  const tickColor = isDark ? '#a1a1aa' : '#71717a'
  const tooltipBg = isDark ? '#27272a' : '#ffffff'
  const tooltipBorder = isDark ? '#3f3f46' : '#e4e4e7'
  const tooltipLabel = isDark ? '#e4e4e7' : '#18181b'
  const legendColor = isDark ? '#a1a1aa' : '#71717a'

  const periods = Object.keys(results.hydrographs).map(Number) as ReturnPeriod[]

  // Merge all hydrograph time steps into unified dataset
  const allTimes = new Set<number>()
  for (const p of periods) {
    results.hydrographs[p]?.forEach((pt) => allTimes.add(pt.timeHr))
  }
  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b)

  const data = sortedTimes.map((t) => {
    const row: Record<string, number> = { time: t }
    for (const p of periods) {
      const hydrograph = results.hydrographs[p] ?? []
      const pt = hydrograph.find((h) => h.timeHr === t)
      row[`${p}yr`] = pt?.flowCfs ?? 0
    }
    return row
  })

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="time"
            stroke={axisColor}
            tick={{ fill: tickColor, fontSize: 11 }}
            label={{ value: 'Time (hr)', position: 'insideBottom', offset: -3, fill: axisColor, fontSize: 11 }}
          />
          <YAxis
            stroke={axisColor}
            tick={{ fill: tickColor, fontSize: 11 }}
            label={{ value: 'Q (cfs)', angle: -90, position: 'insideLeft', fill: axisColor, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 6 }}
            labelStyle={{ color: tooltipLabel, fontSize: 12 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(val: number, name: string) => [`${val.toFixed(1)} cfs`, name]}
            labelFormatter={(l) => `t = ${Number(l).toFixed(2)} hr`}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: legendColor }} />
          {periods.map((p) => (
            <Area
              key={p}
              type="monotone"
              dataKey={`${p}yr`}
              name={`${p}-yr`}
              stroke={PERIOD_COLORS[p]}
              fill={PERIOD_COLORS[p]}
              fillOpacity={0.08}
              strokeWidth={1.5}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
