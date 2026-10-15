import { ChevronRight } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useWeighIns } from '@/data/body'
import type { BodyMeasurement } from '@/data/types'
import { localDateKey, rollingAverage, weeklyRate } from '@/lib/body'
import { formatDay } from '@/lib/dates'
import { kgToLb } from '@/lib/units'
import { WeighInSheet } from './WeighInSheet'

const BodyChart = lazy(() => import('./BodyChart'))

type BodyMetric = 'weight' | 'fat' | 'muscle'
const METRICS: { key: BodyMetric; label: string; unit: string; get: (m: BodyMeasurement) => number | null }[] = [
  { key: 'weight', label: 'Weight', unit: 'lb', get: (m) => (m.weight_kg == null ? null : kgToLb(m.weight_kg)) },
  { key: 'fat', label: 'Body fat', unit: '%', get: (m) => m.body_fat_pct },
  { key: 'muscle', label: 'Muscle mass', unit: 'lb', get: (m) => (m.muscle_mass_kg == null ? null : kgToLb(m.muscle_mass_kg)) },
]
const RANGES = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All', days: Infinity },
]

/** Progress → Body: trend chart, weekly rate, and the list of weigh-ins (tap to edit). */
export function BodyView() {
  const entries = useWeighIns()
  const [metricKey, setMetricKey] = useState<BodyMetric>('weight')
  const [rangeDays, setRangeDays] = useState(90)
  const [editing, setEditing] = useState<{ date: string; existing?: BodyMeasurement } | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [today] = useState(() => localDateKey(new Date()))

  const view = useMemo(() => {
    if (!entries) return null
    const available = METRICS.filter((m) => entries.some((e) => m.get(e) !== null))
    const metric = available.find((m) => m.key === metricKey) ?? available[0] ?? METRICS[0]
    const all = entries.flatMap((e) => {
      const v = metric.get(e)
      return v === null ? [] : [{ date: e.measured_on, value: v }]
    })
    const avg = rollingAverage(all)
    const cutoff = Number.isFinite(rangeDays) ? localDateKey(new Date(Date.parse(today + 'T12:00:00') - rangeDays * 86_400_000)) : ''
    const rows = all
      .map((p, i) => ({ date: p.date, t: Date.parse(p.date + 'T12:00:00'), raw: p.value, avg: avg[i].value }))
      .filter((r) => r.date > cutoff)
    return { available, metric, rows, rate: weeklyRate(all, today), latestAvg: avg.at(-1)?.value ?? null }
  }, [entries, metricKey, rangeDays, today])

  if (!view || !entries) return null
  const chip = (active: boolean) =>
    `min-h-10 rounded-full border px-3 text-sm ${active ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`
  const list = [...entries].reverse()
  const { metric, rows, rate } = view
  const unitText = metric.unit === '%' ? ' percentage points' : ` ${metric.unit}`

  return (
    <div className="space-y-4">
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted">
          No weigh-ins yet. Use <span className="text-text">Weigh in</span> on the Today tab.
        </p>
      ) : (
        <>
          {view.available.length > 1 && (
            <div className="flex gap-2">
              {view.available.map((m) => (
                <button key={m.key} type="button" aria-pressed={metric.key === m.key} onClick={() => setMetricKey(m.key)} className={chip(metric.key === m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
          <section className="rounded-2xl border border-border bg-surface p-3">
            <div className="mb-1 flex items-baseline justify-between px-1">
              <p className="text-sm text-muted">
                {metric.label}
                {view.latestAvg !== null && (
                  <>
                    {' '}· 7-day avg <span className="font-semibold text-text">{view.latestAvg.toFixed(1)}{metric.unit === '%' ? '%' : ` ${metric.unit}`}</span>
                  </>
                )}
              </p>
            </div>
            <p className="mb-2 px-1 text-sm">
              {rate === null
                ? <span className="text-muted">Weigh in most days for 1–2 weeks to see your weekly rate.</span>
                : <>
                    <span className="font-semibold">{rate > 0 ? '+' : ''}{rate.toFixed(1)}</span>
                    {unitText}/week <span className="text-muted">over the last 2 weeks</span>
                  </>}
            </p>
            {/* Two series → a legend, so identity never relies on colour alone. */}
            <div className="mb-1 flex gap-4 px-1 text-xs text-muted" aria-hidden>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted/60" /> Each day</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-chart" /> 7-day average</span>
            </div>
            <div className="h-56">
              {rows.length >= 2 ? (
                <Suspense fallback={null}>
                  <BodyChart rows={rows} unit={metric.unit} />
                </Suspense>
              ) : (
                <p className="py-16 text-center text-sm text-muted">Two or more weigh-ins in this range draw the chart.</p>
              )}
            </div>
            <div className="mt-2 flex gap-2 px-1">
              {RANGES.map((r) => (
                <button key={r.label} type="button" aria-pressed={rangeDays === r.days} onClick={() => setRangeDays(r.days)} className={chip(rangeDays === r.days)}>
                  {r.label}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="font-semibold">Weigh-ins</h2>
          <label className="flex min-h-10 items-center gap-2 text-sm text-accent">
            + Other day
            <input
              type="date"
              max={today}
              aria-label="Add a weigh-in for another day"
              onChange={(e) => {
                const date = e.target.value
                if (date) setEditing({ date, existing: entries.find((x) => x.measured_on === date) })
                e.target.value = ''
              }}
              className="w-0 opacity-0"
            />
          </label>
        </div>
        <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
          {(showAll ? list : list.slice(0, 14)).map((e) => (
            <li key={e.id} className="border-b border-border last:border-b-0">
              <button type="button" onClick={() => setEditing({ date: e.measured_on, existing: e })} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
                <span className="w-28 text-sm text-muted">{formatDay(e.measured_on + 'T12:00:00')}</span>
                <span className="flex-1 text-sm tabular-nums">
                  {e.weight_kg !== null ? `${kgToLb(e.weight_kg).toFixed(1)} lb` : '—'}
                  {e.body_fat_pct !== null && <span className="text-muted"> · {e.body_fat_pct}%</span>}
                  {e.muscle_mass_kg !== null && <span className="text-muted"> · {kgToLb(e.muscle_mass_kg).toFixed(1)} lb muscle</span>}
                </span>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-4 py-4 text-sm text-muted">Nothing logged yet.</li>}
        </ul>
        {list.length > 14 && !showAll && (
          <button type="button" onClick={() => setShowAll(true)} className="mt-2 min-h-10 w-full text-sm text-accent">
            Show all {list.length}
          </button>
        )}
      </section>

      {editing && (
        <WeighInSheet
          date={editing.date}
          existing={editing.existing}
          history={entries}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
