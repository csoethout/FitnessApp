import { ChevronLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useProgressData } from '@/data/progress'
import { formatDay } from '@/lib/dates'
import { formatWeight } from '@/lib/logger'
import { chooseMetric, sessionPoints, type Metric } from '@/lib/progress'
import { formatMetric, metricLabel } from '@/lib/progressFormat'
import { countedSets } from '@/lib/stats'
import { kgToLb } from '@/lib/units'

const UNIT = 'lb' as const

/** One lift over time: trend chart (est. 1-rep max / heaviest / reps), best-ever numbers and every session. */
export default function ExerciseProgressScreen() {
  const { exerciseId } = useParams()
  const data = useProgressData()
  const [picked, setPicked] = useState<Metric | null>(null)

  const model = useMemo(() => {
    if (!data || !exerciseId) return null
    const sessions = data.sessions.filter((s) => s.exerciseId === exerciseId).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    const points = sessionPoints(sessions)
    const available = (['e1rm', 'weight', 'reps'] as Metric[]).filter((m) => points.some((p) => p[m] !== null))
    const all = sessions.flatMap((s) => countedSets(s.sets))
    const heaviestSet = all.reduce<(typeof all)[number] | null>(
      (best, s) => (!best || s.weight_kg > best.weight_kg || (s.weight_kg === best.weight_kg && s.reps > best.reps) ? s : best),
      null,
    )
    const bestE1rm = Math.max(0, ...points.map((p) => p.e1rm ?? 0))
    return { exercise: data.exercises.get(exerciseId), sessions, points, available, defaultMetric: chooseMetric(points), heaviestSet, bestE1rm }
  }, [data, exerciseId])

  if (!model) return null
  const metric = picked && model.available.includes(picked) ? picked : model.defaultMetric
  // Plot in display units (lb) so the axis reads naturally.
  const chartData = model.points
    .filter((p) => p[metric] !== null)
    .map((p) => ({ date: p.date, value: metric === 'reps' ? p[metric]! : Math.round(kgToLb(p[metric]!) * 10) / 10 }))

  return (
    <>
      <Link to="/progress" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
        <ChevronLeft size={20} /> Progress
      </Link>
      <h1 className="mb-3 text-2xl font-semibold">{model.exercise?.name ?? 'Exercise'}</h1>

      {model.available.length > 1 && (
        <div className="mb-3 flex gap-2">
          {model.available.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={metric === m}
              onClick={() => setPicked(m)}
              className={`min-h-10 rounded-full border px-3 text-sm ${metric === m ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`}
            >
              {metricLabel(m)}
            </button>
          ))}
        </div>
      )}

      <section className="mb-4 rounded-2xl border border-border bg-surface p-3">
        <p className="mb-2 px-1 text-sm text-muted">
          {metricLabel(metric)} per session{metric === 'reps' ? '' : ` (${UNIT})`}
        </p>
        {chartData.length < 2 ? (
          <p className="px-1 py-8 text-center text-sm text-muted">Log this exercise again to see a trend.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--color-grid)" strokeWidth={1} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  tick={{ fill: 'var(--color-muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  // Round, readable ticks (220, 230…) with a little headroom.
                  domain={[(min: number) => Math.floor((min - 2) / 10) * 10, (max: number) => Math.ceil((max + 2) / 10) * 10]}
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
                        <p className="text-muted">{formatDay(payload[0].payload.date)}</p>
                        <p className="font-semibold">
                          {payload[0].value}
                          {metric === 'reps' ? ' reps' : ` ${UNIT}`}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Line
                  type="linear"
                  dataKey="value"
                  stroke="var(--color-chart)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  dot={{ r: 4, fill: 'var(--color-chart)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: 'var(--color-chart)', stroke: 'var(--color-surface)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="mb-4 grid grid-cols-2 gap-2">
        {model.bestE1rm > 0 && <Tile label="Best est. 1-rep max" value={formatMetric(model.bestE1rm, 'e1rm')} />}
        {model.heaviestSet && model.heaviestSet.weight_kg > 0 && (
          <Tile label="Heaviest set" value={`${formatWeight(model.heaviestSet.weight_kg, UNIT)} ${UNIT} × ${model.heaviestSet.reps}`} />
        )}
        <Tile label="Sessions" value={String(model.sessions.length)} />
      </div>

      <h2 className="mb-2 px-1 font-semibold">Sessions</h2>
      <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
        {[...model.sessions].reverse().map((s) => (
          <li key={s.workoutId} className="border-b border-border px-4 py-3 last:border-b-0">
            <Link to={`/history/${s.workoutId}`} className="block">
              <p className="text-sm">{formatDay(s.startedAt)}</p>
              <p className="text-sm text-muted">
                {s.sets
                  .filter((x) => x.set_type !== 'warmup')
                  .map((x) => `${formatWeight(x.weight_kg, UNIT)}×${x.reps}${x.set_type === 'limited' ? '*' : ''}`)
                  .join(' · ')}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  )
}
