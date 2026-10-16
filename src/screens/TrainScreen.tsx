import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { HistoryList } from '@/components/HistoryList'
import { ScreenHeader } from '@/components/ScreenHeader'
import { TodayWorkoutCard } from '@/components/TodayWorkoutCard'
import { useData } from '@/data/DataProvider'
import { useFeatures } from '@/data/profile'
import { useActiveWeek, useDayExerciseCounts } from '@/data/queries'
import { applyBlankWeek } from '@/data/setup'
import { WEEKDAYS } from '@/lib/dates'

export function TrainScreen() {
  const week = useActiveWeek()
  return (
    <>
      <ScreenHeader title="Train" subtitle={week?.template ? 'Your week' : undefined} />
      {week === undefined ? null : week.template ? <WeekOverview days={week.days} /> : <SetUpWeek />}
    </>
  )
}

function WeekOverview({ days }: { days: NonNullable<ReturnType<typeof useActiveWeek>>['days'] }) {
  const counts = useDayExerciseCounts(days.map((d) => d.id))
  const [today] = useState(() => new Date().getDay())
  const features = useFeatures()
  return (
    <div className="space-y-3">
      <TodayWorkoutCard />
      {features?.planWeek && (
        <Link to="/train/week" className="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4">
          <CalendarDays size={20} className="text-accent" />
          <span className="flex-1">
            <span className="block font-medium">Plan my week</span>
            <span className="block text-xs text-muted">Short, busy or away days? The week adapts.</span>
          </span>
          <ChevronRight className="text-muted" size={20} aria-hidden />
        </Link>
      )}
      <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
        {days.map((d) => (
          <li key={d.id} className="border-b border-border last:border-b-0">
            <Link to={`/train/day/${d.id}`} className="flex min-h-16 items-center gap-3 px-4">
              <span className={`w-10 text-sm ${d.day_of_week === today ? 'font-semibold text-accent' : 'text-muted'}`}>
                {WEEKDAYS[d.day_of_week].slice(0, 3)}
              </span>
              <span className="flex-1">
                <span className={d.is_rest ? 'text-muted' : ''}>{d.is_rest ? 'Rest day' : d.name}</span>
                {!d.is_rest && <span className="block text-xs text-muted">{counts?.get(d.id) ?? 0} exercises</span>}
              </span>
              <ChevronRight className="text-muted" size={20} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="px-1 text-xs text-muted">Your usual week. Tap a day to change its name or exercises.</p>
      <div className="flex items-baseline justify-between px-1 pt-3">
        <h2 className="font-semibold">Recent workouts</h2>
        <Link to="/history" className="min-h-10 text-sm text-accent">
          See all
        </Link>
      </div>
      <HistoryList limit={3} />
    </div>
  )
}

function SetUpWeek() {
  const { db, store } = useData()
  const libraryCount = useLiveQuery(() => db.exercises.count(), [db]) ?? 0
  const [busy, setBusy] = useState(false)
  const ready = libraryCount > 0

  async function blank() {
    setBusy(true)
    await applyBlankWeek(store)
    setBusy(false)
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h2 className="text-lg font-semibold">Set up your week</h2>
        <p className="text-sm text-muted">
          Answer a few questions (days, time, gym) and I'll build a week for you. Every exercise can be changed afterwards.
        </p>
      </div>
      {!ready && <p className="text-sm text-amber-400">Downloading the exercise library… (needs a connection the first time)</p>}
      <Link
        to="/setup"
        aria-disabled={!ready}
        className={`flex min-h-12 w-full items-center justify-center rounded-xl bg-accent font-semibold text-accent-ink ${ready ? '' : 'pointer-events-none opacity-50'}`}
      >
        Build a week for me
      </Link>
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => void blank()}
        className="min-h-12 w-full rounded-xl border border-border bg-surface-2 disabled:opacity-50"
      >
        Start with an empty week
      </button>
    </section>
  )
}
