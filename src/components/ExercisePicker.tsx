import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useData } from '@/data/DataProvider'
import type { Exercise } from '@/data/types'
import { filterExercises, MUSCLE_GROUPS } from '@/lib/training'

type Props = {
  title?: string
  excludeIds?: Set<string>
  initialMuscles?: string[] | null
  onPick: (exercise: Exercise) => void
  onClose: () => void
}

const MAX_RESULTS = 80

/** Full-screen exercise search. Defaults to exercises your gym can do; one tap to include everything. */
export function ExercisePicker({ title = 'Add exercise', excludeIds, initialMuscles = null, onPick, onClose }: Props) {
  const { db } = useData()
  const exercises = useLiveQuery(() => db.exercises.toArray(), [db])
  const gym = useLiveQuery(async () => (await db.equipment_profiles.toArray()).find((p) => p.is_default && !p.deleted_at), [db])
  const [query, setQuery] = useState('')
  const [muscles, setMuscles] = useState<string[] | null>(initialMuscles)
  const [onlyMyGym, setOnlyMyGym] = useState(true)

  const results = useMemo(
    () => filterExercises(exercises ?? [], { query, muscles, equipment: onlyMyGym && gym ? gym.equipment : null, excludeIds }),
    [exercises, query, muscles, onlyMyGym, gym, excludeIds],
  )

  const chip = (active: boolean) =>
    `min-h-10 shrink-0 rounded-full border px-4 text-sm ${active ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-4 pt-3">
        <h2 className="flex-1 text-xl font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-12 place-items-center rounded-xl">
          <X />
        </button>
      </div>
      <div className="px-4 pt-2">
        <input
          autoFocus
          type="search"
          placeholder="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-border bg-surface-2 px-4 text-base outline-none focus:border-accent"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        <button type="button" className={chip(muscles === null)} onClick={() => setMuscles(null)}>
          All
        </button>
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g.label}
            type="button"
            className={chip(muscles === g.muscles)}
            onClick={() => setMuscles(muscles === g.muscles ? null : g.muscles)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-3 px-4 pb-2 text-sm text-muted">
        <input type="checkbox" checked={onlyMyGym} onChange={(e) => setOnlyMyGym(e.target.checked)} className="size-5 accent-accent" />
        Only equipment at {gym?.name ?? 'my gym'}
      </label>
      <ul className="flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {results.slice(0, MAX_RESULTS).map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e)}
              className="flex min-h-14 w-full flex-col justify-center border-b border-border py-2 text-left"
            >
              <span>{e.name}</span>
              <span className="text-xs capitalize text-muted">
                {[e.primary_muscles.join(', '), e.equipment, e.mechanic].filter(Boolean).join(' · ')}
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="py-8 text-center text-muted">No matches</li>}
        {results.length > MAX_RESULTS && (
          <li className="py-4 text-center text-xs text-muted">Showing {MAX_RESULTS} of {results.length}. Type to narrow down.</li>
        )}
      </ul>
    </div>
  )
}
