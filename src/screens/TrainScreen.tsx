import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'
import { useData } from '@/data/DataProvider'
import { useActiveWeek, useDayExerciseCounts } from '@/data/queries'
import { applyBlankWeek, applyStarterSplit } from '@/data/setup'
import { WEEKDAYS } from '@/lib/dates'
import { STARTER_SPLIT } from '@/lib/starterSplit'

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
  return (
    <div className="space-y-3">
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
      <p className="px-1 text-xs text-muted">Tap a day to change its name or exercises.</p>
      <Placeholder phase={2}>Start workout (next step)</Placeholder>
    </div>
  )
}

function SetUpWeek() {
  const { db, store } = useData()
  const libraryCount = useLiveQuery(() => db.exercises.count(), [db]) ?? 0
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const ready = libraryCount > 0

  async function run(kind: 'starter' | 'blank') {
    setBusy(true)
    if (kind === 'starter') {
      const { missing } = await applyStarterSplit(store, STARTER_SPLIT)
      if (missing.length) setNote(`Skipped ${missing.length} exercise(s) not found in the library.`)
    } else {
      await applyBlankWeek(store)
    }
    setBusy(false)
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h2 className="text-lg font-semibold">Set up your week</h2>
        <p className="text-sm text-muted">
          The starter split matches your schedule: Back &amp; Shoulders, Legs, Chest, Back, Arms &amp; Abs, rest Friday, Full
          Body. Every exercise can be changed afterwards.
        </p>
      </div>
      {!ready && <p className="text-sm text-amber-400">Downloading the exercise library… (needs a connection the first time)</p>}
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => void run('starter')}
        className="min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-ink disabled:opacity-50"
      >
        Use starter split
      </button>
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => void run('blank')}
        className="min-h-12 w-full rounded-xl border border-border bg-surface-2 disabled:opacity-50"
      >
        Start with an empty week
      </button>
      {note && <p className="text-sm text-muted">{note}</p>}
    </section>
  )
}
