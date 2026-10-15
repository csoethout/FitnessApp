import { useLiveQuery } from 'dexie-react-hooks'
import { useData } from './DataProvider'
import type { LocalStore } from './store'
import type { BodyMeasurement } from './types'

export type WeighIn = { weight_kg: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null }

/**
 * Save the weigh-in for a day (one per day). Re-uses that day's row if it exists, even a deleted one,
 * because the server only allows one row per user per day.
 */
export async function saveWeighIn(store: LocalStore, date: string, values: WeighIn): Promise<BodyMeasurement> {
  const existing = await store.db.body_measurements.where('measured_on').equals(date).first()
  if (existing) return store.update('body_measurements', existing.id, { ...values, deleted_at: null })
  return store.insert('body_measurements', { measured_on: date, note: null, ...values })
}

export async function deleteWeighIn(store: LocalStore, id: string) {
  await store.remove('body_measurements', id)
}

/** All weigh-ins, oldest first. undefined while loading. */
export function useWeighIns() {
  const { db } = useData()
  return useLiveQuery(
    async () => (await db.body_measurements.orderBy('measured_on').toArray()).filter((m) => !m.deleted_at),
    [db],
  )
}
