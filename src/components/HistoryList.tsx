import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useData } from '@/data/DataProvider'
import { workoutHistory } from '@/data/history'
import { formatDay, formatDuration } from '@/lib/dates'
import { formatWeight } from '@/lib/logger'

/** Finished workouts, newest first. */
export function HistoryList({ limit }: { limit?: number }) {
  const { db } = useData()
  const rows = useLiveQuery(() => workoutHistory(db, limit), [db, limit])
  if (!rows) return null
  if (!rows.length) return <p className="px-1 text-sm text-muted">No finished workouts yet.</p>
  return (
    <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
      {rows.map(({ workout, setCount, volumeKg }) => (
        <li key={workout.id} className="border-b border-border last:border-b-0">
          <Link to={`/history/${workout.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2">
            <span className="flex-1">
              <span className="block">{workout.name ?? 'Workout'}</span>
              <span className="block text-xs text-muted">
                {formatDay(workout.started_at)} ·{' '}
                {workout.ended_at ? formatDuration(Date.parse(workout.ended_at) - Date.parse(workout.started_at)) : ''} ·{' '}
                {setCount} sets · {Number(formatWeight(volumeKg, 'lb')).toLocaleString()} lb
              </span>
            </span>
            <ChevronRight size={20} className="text-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
