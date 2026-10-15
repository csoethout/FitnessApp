import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDay } from '@/lib/dates'

export type BodyChartRow = { date: string; t: number; raw: number; avg: number }

/**
 * Daily readings as faint dots, 7-day average as the bold line (the number to watch).
 * Lazy-loaded so the charting library only downloads when the Body tab is opened.
 */
export default function BodyChart({ rows, unit }: { rows: BodyChartRow[]; unit: string }) {
  const fmt = (v: number) => `${v.toFixed(1)}${unit === '%' ? '%' : ` ${unit}`}`
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} stroke="var(--color-grid)" strokeWidth={1} />
        {/* Real time scale: a week without weigh-ins shows as a gap instead of being squeezed out. */}
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]}
          allowDecimals={false}
          tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ stroke: 'var(--color-muted)', strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm shadow">
                <p className="text-muted">{formatDay(payload[0].payload.date + 'T12:00:00')}</p>
                <p>That day: {fmt(payload[0].payload.raw)}</p>
                <p className="font-semibold">7-day avg: {fmt(payload[0].payload.avg)}</p>
              </div>
            ) : null
          }
        />
        <Line
          dataKey="raw"
          stroke="none"
          dot={{ r: 3, fill: 'var(--color-muted)', fillOpacity: 0.6, stroke: 'none' }}
          activeDot={{ r: 5, fill: 'var(--color-muted)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
        <Line
          dataKey="avg"
          stroke="var(--color-chart)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          dot={false}
          activeDot={{ r: 5, fill: 'var(--color-chart)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
