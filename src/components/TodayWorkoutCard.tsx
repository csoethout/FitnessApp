import { Play } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useActiveWeek, useActiveWorkout } from '@/data/queries'
import { useStartWorkout } from '@/data/useStartWorkout'
import { formatElapsed } from '@/lib/logger'
import { useNow } from '@/lib/useNow'

/** "Resume" if a workout is running; otherwise today's planned session with a big Start button. */
export function TodayWorkoutCard() {
  const active = useActiveWorkout()
  const week = useActiveWeek()
  const start = useStartWorkout()
  const now = useNow(30_000)
  const [today] = useState(() => new Date().getDay())
  const [busy, setBusy] = useState(false)

  if (active === undefined || week === undefined) return null

  if (active) {
    return (
      <Link to={`/workout/${active.id}`} className="block rounded-2xl border border-accent bg-accent/10 p-4">
        <p className="text-sm text-accent">In progress · {formatElapsed(now - Date.parse(active.started_at))}</p>
        <p className="text-lg font-semibold">{active.name ?? 'Workout'}</p>
        <p className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-accent font-semibold text-accent-ink">Resume</p>
      </Link>
    )
  }

  const day = week.days.find((d) => d.day_of_week === today)
  const go = async (id: string | null, name: string) => {
    setBusy(true)
    await start(id, name)
    setBusy(false)
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">Today</p>
      {!week.template ? (
        <p className="text-lg">Set up your week on the Train tab.</p>
      ) : day && !day.is_rest ? (
        <>
          <p className="text-lg font-semibold">{day.name}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void go(day.id, day.name)}
            className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-50"
          >
            <Play size={20} fill="currentColor" /> Start workout
          </button>
        </>
      ) : (
        <p className="text-lg font-semibold">Rest day</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void go(null, 'Workout')}
        className="mt-2 min-h-12 w-full rounded-xl text-sm text-muted"
      >
        Start an empty workout
      </button>
    </section>
  )
}
