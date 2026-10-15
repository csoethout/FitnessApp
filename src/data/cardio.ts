import { useLiveQuery } from 'dexie-react-hooks'
import { addDaysKey } from '@/lib/nutrition'
import { useData } from './DataProvider'
import type { LocalStore } from './store'
import type { CardioActivity, CardioEntry } from './types'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

/** Cardio from `from` to `to` (inclusive, local dates), newest first. undefined while loading. */
export function useCardio(from: string, to: string) {
  const { db } = useData()
  return useLiveQuery(
    async () => live(await db.cardio_entries.where('performed_on').between(from, to, true, true).toArray()).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [db, from, to],
  )
}

/** Your most recent entry of an activity, to pre-fill the next one (you walk the same route most days). */
export async function lastCardio(store: LocalStore, activity: CardioActivity): Promise<CardioEntry | null> {
  const all = live(await store.db.cardio_entries.toArray()).filter((e) => e.activity === activity)
  return all.sort((a, b) => b.performed_on.localeCompare(a.performed_on) || b.created_at.localeCompare(a.created_at))[0] ?? null
}

export function logCardio(store: LocalStore, e: Pick<CardioEntry, 'performed_on' | 'activity' | 'duration_min' | 'distance_km'>) {
  return store.insert('cardio_entries', { ...e, notes: null })
}

export const weekRange = (weekStart: string) => [weekStart, addDaysKey(weekStart, 6)] as const
