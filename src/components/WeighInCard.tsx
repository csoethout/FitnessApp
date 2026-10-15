import { useState } from 'react'
import { useWeighIns } from '@/data/body'
import { localDateKey, rollingAverage } from '@/lib/body'
import { kgToLb } from '@/lib/units'
import { WeighInSheet } from './WeighInSheet'

const lb = (kg: number) => (Math.round(kgToLb(kg) * 10) / 10).toFixed(1)

/** Today: this morning's weight and the 7-day average, or a big "Weigh in" button. */
export function WeighInCard() {
  const entries = useWeighIns()
  const [today] = useState(() => localDateKey(new Date()))
  const [open, setOpen] = useState(false)
  if (!entries) return null

  const todayEntry = entries.find((e) => e.measured_on === today)
  const last = [...entries].reverse().find((e) => e.weight_kg !== null)
  const avg = rollingAverage(entries.filter((e) => e.weight_kg !== null).map((e) => ({ date: e.measured_on, value: e.weight_kg! }))).at(-1)

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">Body weight</p>
      {todayEntry ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-1 flex w-full items-end justify-between text-left">
          <span>
            <span className="text-2xl font-semibold tabular-nums">{todayEntry.weight_kg !== null ? lb(todayEntry.weight_kg) : '—'}</span>{' '}
            <span className="text-muted">lb today</span>
            {(todayEntry.body_fat_pct !== null || todayEntry.muscle_mass_kg !== null) && (
              <span className="block text-xs text-muted">
                {[
                  todayEntry.body_fat_pct !== null && `${todayEntry.body_fat_pct}% body fat`,
                  todayEntry.muscle_mass_kg !== null && `${lb(todayEntry.muscle_mass_kg)} lb muscle`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </span>
          {avg && <span className="text-sm text-muted">7-day avg {lb(avg.value)}</span>}
        </button>
      ) : (
        <>
          {last && (
            <p className="text-sm text-muted">
              Last: {lb(last.weight_kg!)} lb{avg ? ` · 7-day avg ${lb(avg.value)}` : ''}
            </p>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-3 min-h-14 w-full rounded-xl border border-accent text-lg font-semibold text-accent"
          >
            Weigh in
          </button>
        </>
      )}
      {open && <WeighInSheet date={today} existing={todayEntry} history={entries} onClose={() => setOpen(false)} />}
    </section>
  )
}
