import { Check, ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Stepper } from '@/components/Stepper'
import { useData, useFirstSyncDone } from '@/data/DataProvider'
import { ensureWeekPlan, resetWeek, setDay, useWeek, weekStartOf, type WeekView } from '@/data/weekPlan'
import type { WeekPlanDay } from '@/data/types'
import { localDateKey } from '@/lib/body'
import { addDaysKey } from '@/lib/nutrition'
import { WEEKDAY_SHORT, type DayStatus, type PlannedDay } from '@/lib/planner/week'

const STATUSES: { key: DayStatus; label: string }[] = [
  { key: 'normal', label: 'Normal' },
  { key: 'short', label: 'Short' },
  { key: 'busy', label: 'Busy' },
  { key: 'away', label: 'Away' },
]

/**
 * Plan my week: mark each day normal / short / busy / away and the week adapts (moves, merges, shortens, swaps).
 * Opening a week creates its plan (all normal = your template); the Today card then follows it.
 */
export function WeekPlanScreen() {
  const [today] = useState(() => localDateKey(new Date()))
  const [which, setWhich] = useState<'this' | 'next'>('this')
  const weekStart = which === 'this' ? weekStartOf(today) : addDaysKey(weekStartOf(today), 7)
  const { store } = useData()
  const week = useWeek(weekStart)

  const synced = useFirstSyncDone()
  useEffect(() => {
    // Only after this device's first full download: the week may already exist on the server (another device).
    if (synced) void ensureWeekPlan(store, weekStart)
  }, [store, weekStart, synced])

  const tab = (on: boolean) => `min-h-11 flex-1 rounded-lg text-sm ${on ? 'bg-surface-2 font-semibold' : 'text-muted'}`
  return (
    <>
      <Link to="/train" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
        <ChevronLeft size={20} /> Train
      </Link>
      <h1 className="text-2xl font-semibold">Plan my week</h1>
      <p className="mb-3 text-sm text-muted">Tell the app which days are short, busy or away. It moves, shortens and swaps workouts to fit.</p>
      <div className="mb-3 flex rounded-xl bg-surface p-1" role="tablist">
        <button type="button" role="tab" aria-selected={which === 'this'} onClick={() => setWhich('this')} className={tab(which === 'this')}>
          This week
        </button>
        <button type="button" role="tab" aria-selected={which === 'next'} onClick={() => setWhich('next')} className={tab(which === 'next')}>
          Next week
        </button>
      </div>
      {week && <WeekDays week={week} today={today} />}
    </>
  )
}

function WeekDays({ week, today }: { week: WeekView; today: string }) {
  const { store } = useData()
  if (!week.plan || week.rows.size < 7) return null
  const rows = [...week.rows.values()]
  const changed = rows.some((r) => r.status !== 'normal')
  return (
    <div className="space-y-2">
      {week.days.map((d) => (
        <DayCard key={d.date} day={d} row={week.rows.get(d.date)!} today={today} week={week} />
      ))}
      {changed && (
        <button type="button" onClick={() => void resetWeek(store, rows)} className="min-h-12 w-full text-sm text-muted">
          Reset to my usual week
        </button>
      )}
      <p className="px-1 pt-2 text-xs text-muted">
        Busy days and missed sessions move to free rest days (sessions with the most main lifts first). With no free day, their main lifts
        are added to another day. Short days drop extra exercises before main lifts.
      </p>
    </div>
  )
}

function DayCard({ day, row, today, week }: { day: PlannedDay; row: WeekPlanDay; today: string; week: WeekView }) {
  const { store } = useData()
  const past = day.date < today
  const isToday = day.date === today
  const dd = Number(day.date.slice(8))
  const label = `${WEEKDAY_SHORT[new Date(day.date + 'T12:00:00').getDay()]} ${dd}`
  const set = (changes: Partial<Pick<WeekPlanDay, 'status' | 'minutes_available' | 'equipment_profile_id'>>) =>
    void setDay(store, row, {
      status: changes.status ?? row.status,
      minutes_available: 'minutes_available' in changes ? changes.minutes_available! : row.minutes_available,
      equipment_profile_id: 'equipment_profile_id' in changes ? changes.equipment_profile_id! : row.equipment_profile_id,
    })
  const done = past && !!day.session // past sessions that weren't done have been moved away
  const otherGyms = week.gyms.filter((g) => !g.is_default)
  const chip = (on: boolean) => `min-h-10 flex-1 rounded-lg border text-sm ${on ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`

  return (
    <section className={`rounded-2xl border bg-surface p-3 ${isToday ? 'border-accent/60' : 'border-border'} ${past ? 'opacity-60' : ''}`} aria-label={label}>
      <div className="flex items-baseline gap-2">
        <span className={`w-14 shrink-0 text-sm ${isToday ? 'font-semibold text-accent' : 'text-muted'}`}>{isToday ? 'Today' : label}</span>
        <span className="min-w-0 flex-1 font-medium">
          {day.session ? day.session.name : <span className="text-muted">Rest</span>}
          {day.session && day.minutes > 0 && <span className="ml-2 text-xs font-normal text-muted">~{day.minutes} min</span>}
        </span>
        {done && day.session && <Check size={16} className="text-accent" aria-label="Done" />}
      </div>
      {day.notes.map((n) => (
        <p key={n} className="mt-1 text-xs text-muted">
          {n}
        </p>
      ))}
      {!past && (
        <>
          <div className="mt-2 flex gap-1" role="group" aria-label={`${label} status`}>
            {STATUSES.map((s) => (
              <button key={s.key} type="button" aria-pressed={row.status === s.key} onClick={() => set({ status: s.key })} className={chip(row.status === s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          {row.status === 'short' && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm">Time you have</span>
              <Stepper
                label={`minutes on ${label}`}
                value={row.minutes_available ?? 45}
                step={5}
                min={10}
                max={120}
                format={(v) => `${v} min`}
                onChange={(v) => set({ minutes_available: v })}
              />
            </div>
          )}
          {row.status === 'away' && (
            <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={`${label} where`}>
              <button type="button" aria-pressed={!row.equipment_profile_id} onClick={() => set({ equipment_profile_id: null })} className={chip(!row.equipment_profile_id)}>
                No gym
              </button>
              {otherGyms.map((g) => (
                <button key={g.id} type="button" aria-pressed={row.equipment_profile_id === g.id} onClick={() => set({ equipment_profile_id: g.id })} className={chip(row.equipment_profile_id === g.id)}>
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
