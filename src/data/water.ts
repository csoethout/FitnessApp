import { useLiveQuery } from 'dexie-react-hooks'
import { rollingAverage } from '@/lib/body'
import { DEFAULT_BOTTLE_OZ, ozToMl, suggestedGoalOz } from '@/lib/water'
import { useData } from './DataProvider'
import { saveProfile } from './profile'
import type { LocalStore } from './store'

/** A day's drinks (oldest first), the goal and bottle size. undefined while loading. */
export function useWaterDay(date: string) {
  const { db, store } = useData()
  return useLiveQuery(async () => {
    const entries = (await db.water_entries.where('logged_on').equals(date).toArray())
      .filter((e) => !e.deleted_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    const settings = (await db.profiles.get(store.userId))?.settings ?? {}
    const weighIns = (await db.body_measurements.orderBy('measured_on').toArray()).filter((m) => !m.deleted_at && m.weight_kg !== null)
    const weightKg = rollingAverage(weighIns.map((m) => ({ date: m.measured_on, value: m.weight_kg! }))).at(-1)?.value ?? null
    const suggested = suggestedGoalOz(weightKg)
    return {
      entries,
      goalOz: settings.waterGoalOz ?? suggested,
      suggestedOz: suggested,
      customGoal: settings.waterGoalOz != null,
      bottleOz: settings.waterBottleOz ?? DEFAULT_BOTTLE_OZ,
    }
  }, [db, store.userId, date])
}

export const logWater = (store: LocalStore, date: string, oz: number) => store.insert('water_entries', { logged_on: date, amount_ml: ozToMl(oz) })

/** goalOz null = back to the suggested goal. */
export async function saveWaterSettings(store: LocalStore, changes: { waterGoalOz?: number | null; waterBottleOz?: number }) {
  const settings = (await store.db.profiles.get(store.userId))?.settings ?? {}
  await saveProfile(store, { settings: { ...settings, ...changes } })
}
