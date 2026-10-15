import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useData } from '@/data/DataProvider'
import { useMainGym } from '@/data/queries'
import type { Exercise } from '@/data/types'
import { rankAlternatives } from '@/lib/swap'
import { ExercisePicker } from './ExercisePicker'
import { Sheet } from './Sheet'

type Props = {
  target: Exercise
  excludeIds: Set<string>
  /** Show "also replace in my weekly plan" (logger only). */
  planOption?: boolean
  planDefault?: boolean
  title?: string
  onPick: (exercise: Exercise, alsoInPlan: boolean) => void
  onClose: () => void
}

const SHOWN = 12

/** Best substitutes for an exercise that the gym can do, plus a way out to the full search. */
export function SwapSheet({ target, excludeIds, planOption, planDefault = false, title, onPick, onClose }: Props) {
  const { db } = useData()
  const all = useLiveQuery(() => db.exercises.toArray(), [db])
  const gymInfo = useMainGym()
  const [alsoInPlan, setAlsoInPlan] = useState(planDefault)
  const [searching, setSearching] = useState(false)

  const alternatives = useMemo(
    () =>
      all && gymInfo
        ? rankAlternatives(target, all, {
            equipment: gymInfo.gym?.equipment ?? null,
            unavailableIds: gymInfo.unavailableIds,
            excludeIds,
          }).slice(0, SHOWN)
        : [],
    [all, gymInfo, target, excludeIds],
  )

  if (searching) {
    return (
      <ExercisePicker
        title={`Swap ${target.name}`}
        excludeIds={new Set([...excludeIds, target.id])}
        initialMuscles={target.primary_muscles}
        onClose={() => setSearching(false)}
        onPick={(e) => onPick(e, alsoInPlan)}
      />
    )
  }

  return (
    <Sheet title={title ?? `Swap ${target.name}`} onClose={onClose}>
      <p className="pb-2 text-sm text-muted">
        Same muscles: <span className="capitalize">{target.primary_muscles.join(', ')}</span>
      </p>
      {planOption && (
        <label className="mb-2 flex min-h-12 items-center gap-3 rounded-xl bg-surface-2 px-3">
          <input type="checkbox" checked={alsoInPlan} onChange={(e) => setAlsoInPlan(e.target.checked)} className="size-5 accent-accent" />
          <span className="text-sm">Also use it in my weekly plan from now on</span>
        </label>
      )}
      <ul>
        {alternatives.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e, alsoInPlan)}
              className="flex min-h-14 w-full flex-col justify-center border-b border-border py-2 text-left"
            >
              <span>{e.name}</span>
              <span className="text-xs capitalize text-muted">{[e.equipment, e.mechanic].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
        {alternatives.length === 0 && <li className="py-6 text-center text-muted">No close matches at your gym.</li>}
      </ul>
      <button type="button" onClick={() => setSearching(true)} className="my-2 min-h-12 w-full rounded-xl border border-border">
        Search all exercises
      </button>
    </Sheet>
  )
}
