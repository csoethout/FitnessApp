import { useLiveQuery } from 'dexie-react-hooks'
import { Footprints, Plus } from 'lucide-react'
import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { lastCardio, logCardio, useCardio, weekRange } from '@/data/cardio'
import type { CardioActivity, CardioEntry } from '@/data/types'
import { weekStartOf } from '@/data/weekPlan'
import { localDateKey } from '@/lib/body'
import { ACTIVITIES, cardioTotals, describeCardio, kmToMi, miToKm } from '@/lib/cardio'
import { NumberInput } from './NumberInput'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'

const DEFAULT_WALK = { duration_min: 20, distance_km: miToKm(1) }

/** Today: one tap logs your usual walk (same as last time); "Other" for runs, bikes, anything else. */
export function CardioCard() {
  const { store } = useData()
  const [today] = useState(() => localDateKey(new Date()))
  const [from, to] = weekRange(weekStartOf(today))
  const week = useCardio(from, to)
  const lastWalk = useLiveQuery(() => lastCardio(store, 'walk'), [store])
  const [sheet, setSheet] = useState<{ entry: CardioEntry | null } | null>(null)
  if (!week || lastWalk === undefined) return null
  const todays = week.filter((e) => e.performed_on === today)
  const totals = cardioTotals(week)
  const walk = lastWalk ? { duration_min: lastWalk.duration_min, distance_km: lastWalk.distance_km } : DEFAULT_WALK

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-label="Cardio" data-tour="today-cardio">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <Footprints size={18} className="text-accent" /> Cardio
        </h2>
        <span className="text-xs text-muted">
          This week: {totals.sessions}
          {totals.miles > 0 ? ` · ${totals.miles} mi` : ''}
        </span>
      </div>
      {todays.map((e) => (
        <button key={e.id} type="button" onClick={() => setSheet({ entry: e })} className="mt-2 flex min-h-12 w-full items-center rounded-xl bg-surface-2 px-3 text-left text-sm">
          ✓ {describeCardio(e)}
        </button>
      ))}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void logCardio(store, { performed_on: today, activity: 'walk', ...walk })}
          className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-accent font-semibold text-accent-ink"
        >
          <Plus size={18} /> Walk <span className="font-normal">({describeCardio({ activity: 'walk', ...walk }).replace('Walk · ', '')})</span>
        </button>
        <button type="button" onClick={() => setSheet({ entry: null })} className="min-h-12 rounded-xl border border-border px-4">
          Other
        </button>
      </div>
      {sheet && <CardioSheet entry={sheet.entry} date={today} onClose={() => setSheet(null)} />}
    </section>
  )
}

/** Add or edit one cardio entry. */
function CardioSheet({ entry, date, onClose }: { entry: CardioEntry | null; date: string; onClose: () => void }) {
  const { store } = useData()
  const [activity, setActivity] = useState<CardioActivity>(entry?.activity ?? 'run')
  const [minutes, setMinutes] = useState(entry?.duration_min ?? 30)
  const [miles, setMiles] = useState<number | null>(entry?.distance_km ? Math.round(kmToMi(entry.distance_km) * 100) / 100 : null)

  async function save() {
    const fields = { activity, duration_min: minutes, distance_km: miles ? miToKm(miles) : null }
    if (entry) await store.update('cardio_entries', entry.id, fields)
    else await logCardio(store, { performed_on: date, ...fields })
    onClose()
  }
  const chip = (on: boolean) => `min-h-11 rounded-xl border text-sm ${on ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`
  return (
    <Sheet title={entry ? 'Edit cardio' : 'Add cardio'} onClose={onClose}>
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Activity">
          {ACTIVITIES.map((a) => (
            <button key={a.key} type="button" aria-pressed={activity === a.key} onClick={() => setActivity(a.key)} className={chip(activity === a.key)}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span>Minutes</span>
          <Stepper label="minutes" value={minutes} step={5} min={1} max={600} onChange={setMinutes} onTypeValue={(v) => setMinutes(Math.max(1, Math.round(v)))} />
        </div>
        <NumberInput label="Distance" value={miles} onChange={setMiles} suffix="mi" placeholder="optional" />
        <button type="button" onClick={() => void save()} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink">
          Save
        </button>
        {entry && (
          <button type="button" onClick={() => void store.remove('cardio_entries', entry.id).then(onClose)} className="min-h-12 w-full text-sm text-danger">
            Delete
          </button>
        )}
      </div>
    </Sheet>
  )
}
