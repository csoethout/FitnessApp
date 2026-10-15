import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Trophy } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useConfirm } from '@/components/ConfirmProvider'
import { useData } from '@/data/DataProvider'
import { workoutSummary } from '@/data/history'
import { discardWorkout } from '@/data/workouts'
import { formatDay, formatDuration } from '@/lib/dates'
import { formatWeight } from '@/lib/logger'
import type { WeightUnit } from '@/lib/units'

const UNIT: WeightUnit = 'lb'

/** After Finish (with ?new=1) and from History: what you did, totals, and any personal records. */
export function SummaryScreen() {
  const { workoutId } = useParams()
  const [params] = useSearchParams()
  const justFinished = params.get('new') === '1'
  const { db, store } = useData()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const data = useLiveQuery(() => (workoutId ? workoutSummary(db, workoutId) : null), [db, workoutId])

  if (data === undefined) return null
  if (data === null) return <p className="text-muted">Workout not found.</p>
  const { workout, items, totals } = data
  const duration = workout.ended_at ? Date.parse(workout.ended_at) - Date.parse(workout.started_at) : 0
  const volume = Math.round(Number(formatWeight(totals.volumeKg, UNIT)))

  async function remove() {
    const ok = await confirm({ title: 'Delete this workout?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await discardWorkout(store, workout.id)
    navigate('/history')
  }

  return (
    <>
      {!justFinished && (
        <Link to="/history" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
          <ChevronLeft size={20} /> History
        </Link>
      )}
      <header className="mb-4">
        {justFinished && <p className="text-sm font-semibold text-accent">Workout complete</p>}
        <h1 className="text-2xl font-semibold">{workout.name ?? 'Workout'}</h1>
        <p className="text-sm text-muted">{formatDay(workout.started_at)}</p>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Time" value={formatDuration(duration)} />
        <Stat label="Sets" value={String(totals.setCount)} />
        <Stat label={`Volume (${UNIT})`} value={volume.toLocaleString()} />
      </div>

      {totals.prCount > 0 && (
        <section className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-amber-400">
            <Trophy size={18} /> {totals.prCount === 1 ? 'New personal record' : `${totals.prCount} new personal records`}
          </h2>
          <ul className="space-y-1 text-sm">
            {items.flatMap((it) =>
              it.prs.map((pr) => (
                <li key={it.we.id + pr.kind}>
                  <span className="font-medium">{it.exercise?.name}</span>:{' '}
                  {pr.kind === 'e1rm' ? 'estimated 1-rep max' : 'heaviest set'} {formatWeight(pr.value, UNIT)} {UNIT}
                  <span className="text-muted"> (was {formatWeight(pr.previous, UNIT)})</span>
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.we.id} className="rounded-2xl border border-border bg-surface px-4 py-3">
            <p className="font-medium">
              {it.exercise?.name ?? 'Exercise'}
              {it.firstTime && <span className="ml-2 text-xs text-muted">first time</span>}
            </p>
            <p className="text-sm text-muted">
              {it.sets
                .map((s) => `${s.set_type === 'warmup' ? 'W ' : ''}${formatWeight(s.weight_kg, UNIT)}×${s.reps}${s.set_type === 'limited' ? '*' : ''}`)
                .join(' · ')}
            </p>
            {it.bestE1rmKg !== null && (
              <p className="text-xs text-muted">Est. 1-rep max: {formatWeight(it.bestE1rmKg, UNIT)} {UNIT}</p>
            )}
          </li>
        ))}
        {items.length === 0 && <p className="text-muted">No sets were logged.</p>}
      </ul>
      {items.some((it) => it.sets.some((s) => s.set_type === 'limited')) && (
        <p className="mt-2 text-xs text-muted">* couldn't finish (not used for records)</p>
      )}

      <div className="mt-6 space-y-2">
        {justFinished && (
          <button type="button" onClick={() => navigate('/')} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink">
            Done
          </button>
        )}
        <Link to={`/workout/${workout.id}`} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border">
          Edit sets
        </Link>
        <button type="button" onClick={() => void remove()} className="min-h-12 w-full text-sm text-danger">
          Delete workout
        </button>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}
