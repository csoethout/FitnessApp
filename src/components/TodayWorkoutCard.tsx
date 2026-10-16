import { Play } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useFeatures } from '@/data/profile'
import { useActiveWeek, useActiveWorkout } from '@/data/queries'
import { useStartWorkout } from '@/data/useStartWorkout'
import { useTodayPlan } from '@/data/weekPlan'
import { formatElapsed } from '@/lib/logger'
import { useNow } from '@/lib/useNow'

/**
 * "Resume" if a workout is running; otherwise today's session with a big Start button: from Plan my week when
 * you've planned this week (with its notes), else from the weekly template.
 */
export function TodayWorkoutCard() {
  const active = useActiveWorkout()
  const week = useActiveWeek()
  const features = useFeatures()
  const plannedWeek = useTodayPlan()
  const start = useStartWorkout()
  const now = useNow(30_000)
  const [today] = useState(() => new Date().getDay())
  const [busy, setBusy] = useState(false)

  if (active === undefined || week === undefined || plannedWeek === undefined || !features) return null
  const planned = features.planWeek ? plannedWeek : null // switched off: plain template

  if (active) {
    return (
      <Link to={`/workout/${active.id}`} className="block rounded-2xl border border-accent bg-accent/10 p-4">
        <p className="text-sm text-accent">In progress · {formatElapsed(now - Date.parse(active.started_at))}</p>
        <p className="text-lg font-semibold">{active.name ?? 'Workout'}</p>
        <p className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-accent font-semibold text-accent-ink">Resume</p>
      </Link>
    )
  }

  const templateDay = week.days.find((d) => d.day_of_week === today)
  const session = planned
    ? planned.day.session
    : templateDay && !templateDay.is_rest
      ? { name: templateDay.name, templateDayId: templateDay.id, exercises: null }
      : null
  const notes = planned?.day.notes ?? []
  const go = async () => {
    setBusy(true)
    if (planned && session?.exercises) await start(session.templateDayId, session.name, { exercises: session.exercises, weekPlanDayId: planned.row?.id ?? null })
    else await start(session?.templateDayId ?? null, session?.name ?? 'Workout')
    setBusy(false)
  }
  const goEmpty = async () => {
    setBusy(true)
    await start(null, 'Workout')
    setBusy(false)
  }

  return (
    <section data-tour="today-workout" className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">Today</p>
      {!week.template ? (
        <p className="text-lg">Set up your week on the Train tab.</p>
      ) : session ? (
        <>
          <p className="text-lg font-semibold">
            {session.name}
            {planned && planned.day.minutes > 0 && <span className="ml-2 text-sm font-normal text-muted">~{planned.day.minutes} min</span>}
          </p>
          {notes.map((n) => (
            <p key={n} className="text-sm text-muted">
              {n}
            </p>
          ))}
          {session.exercises?.length === 0 ? (
            <p className="mt-2 text-sm">Log it under Cardio below when you're done.</p>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void go()}
              className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-50"
            >
              <Play size={20} fill="currentColor" /> Start workout
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-lg font-semibold">Rest day</p>
          {notes.map((n) => (
            <p key={n} className="text-sm text-muted">
              {n}
            </p>
          ))}
        </>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void goEmpty()}
        className="mt-2 min-h-12 w-full rounded-xl text-sm text-muted"
      >
        Start an empty workout
      </button>
    </section>
  )
}
