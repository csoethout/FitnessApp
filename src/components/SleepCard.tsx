import { Moon } from 'lucide-react'
import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { saveSleep, useSleep } from '@/data/sleep'
import type { SleepEntry } from '@/data/types'
import { localDateKey } from '@/lib/body'
import { addDaysKey } from '@/lib/nutrition'
import { formatClock, formatDuration, hhmm, QUALITY_LABELS, sleepAverage, sleepMinutes } from '@/lib/sleep'
import { Sheet } from './Sheet'

/** Today: last night's sleep (logged under this morning), or a button to log it. Pre-filled from your last night. */
export function SleepCard() {
  const nights = useSleep()
  const [today] = useState(() => localDateKey(new Date()))
  const [open, setOpen] = useState(false)
  if (!nights) return null
  const tonight = nights.find((n) => n.wake_date === today)
  const avg = sleepAverage(nights, addDaysKey(today, -6), today)

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-label="Sleep" data-tour="today-sleep">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Moon size={18} className="text-accent" /> Sleep
        </h2>
        {avg && avg.nights > 1 && <span className="text-xs text-muted">7-day avg {formatDuration(avg.minutes)}</span>}
      </div>
      {tonight ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-1 w-full text-left">
          <span className="text-2xl font-semibold tabular-nums">{formatDuration(tonight.duration_min)}</span>
          {tonight.quality !== null && <span className="ml-2 text-muted">{QUALITY_LABELS[tonight.quality - 1]}</span>}
          <span className="block text-xs text-muted">
            {formatClock(tonight.bed_time)} → {formatClock(tonight.wake_time)}
          </span>
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-14 w-full rounded-xl border border-accent text-lg font-semibold text-accent">
          Log last night
        </button>
      )}
      {open && <SleepSheet date={today} existing={tonight} last={nights[0]} onClose={() => setOpen(false)} />}
    </section>
  )
}

export function SleepSheet({ date, existing, last, onClose }: { date: string; existing?: SleepEntry; last?: SleepEntry; onClose: () => void }) {
  const { store } = useData()
  const [today] = useState(() => localDateKey(new Date()))
  const from = existing ?? last
  const [bed, setBed] = useState(from ? hhmm(from.bed_time) : '23:00')
  const [wake, setWake] = useState(from ? hhmm(from.wake_time) : '07:00')
  const [quality, setQuality] = useState<number | null>(existing?.quality ?? null)
  const valid = /^\d\d:\d\d/.test(bed) && /^\d\d:\d\d/.test(wake)

  async function save() {
    await saveSleep(store, date, { bed_time: bed, wake_time: wake, quality })
    onClose()
  }
  const input = 'min-h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base'
  return (
    <Sheet title={date === today ? 'Last night' : `Night before ${new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`} onClose={onClose}>
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-muted">
            Went to bed
            <input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className={input} />
          </label>
          <label className="text-sm text-muted">
            Woke up
            <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className={input} />
          </label>
        </div>
        {valid && <p className="text-center text-lg font-semibold">{formatDuration(sleepMinutes(bed, wake))}</p>}
        <div>
          <p className="mb-1 text-sm text-muted">How did you sleep? (optional)</p>
          <div className="grid grid-cols-5 gap-1" role="group" aria-label="Sleep quality">
            {QUALITY_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={quality === i + 1}
                onClick={() => setQuality(quality === i + 1 ? null : i + 1)}
                className={`min-h-12 rounded-xl border text-sm ${quality === i + 1 ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" disabled={!valid} onClick={() => void save()} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40">
          Save
        </button>
        {existing && (
          <button type="button" onClick={() => void store.remove('sleep_entries', existing.id).then(onClose)} className="min-h-12 w-full text-sm text-danger">
            Delete
          </button>
        )}
      </div>
    </Sheet>
  )
}
