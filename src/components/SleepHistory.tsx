import { useState } from 'react'
import { useSleep } from '@/data/sleep'
import type { SleepEntry } from '@/data/types'
import { localDateKey } from '@/lib/body'
import { addDaysKey } from '@/lib/nutrition'
import { formatDuration, QUALITY_LABELS, sleepAverage } from '@/lib/sleep'
import { SleepSheet } from './SleepCard'

const SHOWN = 7
const SCALE_MIN = 10 * 60 // bars are drawn against 10 hours

/** Progress → Body: the last week of nights as bars (tap one to edit, or a gap to fill it in). */
export function SleepHistory() {
  const nights = useSleep()
  const [today] = useState(() => localDateKey(new Date()))
  const [editing, setEditing] = useState<{ date: string; existing?: SleepEntry } | null>(null)
  if (!nights) return null
  const byDate = new Map(nights.map((n) => [n.wake_date, n]))
  const avg = sleepAverage(nights, addDaysKey(today, -6), today)
  const prev = sleepAverage(nights, addDaysKey(today, -13), addDaysKey(today, -7))
  const dates = Array.from({ length: SHOWN }, (_, i) => addDaysKey(today, -i))

  return (
    <section className="mt-4 rounded-2xl border border-border bg-surface p-4" aria-label="Sleep">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Sleep</h2>
        <span className="text-xs text-muted">
          {avg ? `7-day avg ${formatDuration(avg.minutes)}${avg.quality !== null ? ` · ${avg.quality}/5` : ''}` : 'No nights logged this week'}
        </span>
      </div>
      {avg && prev && (
        <p className="text-xs text-muted">
          {Math.abs(avg.minutes - prev.minutes) < 10
            ? 'About the same as'
            : `${formatDuration(Math.abs(avg.minutes - prev.minutes))} ${avg.minutes > prev.minutes ? 'more' : 'less'} a night than`}{' '}
          the week before
        </p>
      )}
      <ul className="mt-2">
        {dates.map((d) => {
          const n = byDate.get(d)
          const label = new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' })
          return (
            <li key={d}>
              <button type="button" onClick={() => setEditing({ date: d, existing: n })} className="flex min-h-11 w-full items-center gap-2 text-left text-sm">
                <span className="w-20 shrink-0 text-xs text-muted">{d === today ? 'Last night' : label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  {n && <span className="block h-full rounded-full bg-chart" style={{ width: `${Math.min(1, n.duration_min / SCALE_MIN) * 100}%` }} />}
                </span>
                <span className="w-32 shrink-0 text-right text-xs tabular-nums">
                  {n ? formatDuration(n.duration_min) : <span className="text-muted">+ add</span>}
                  {n?.quality ? <span className="text-muted"> · {QUALITY_LABELS[n.quality - 1]}</span> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {editing && <SleepSheet date={editing.date} existing={editing.existing} last={nights[0]} onClose={() => setEditing(null)} />}
    </section>
  )
}
