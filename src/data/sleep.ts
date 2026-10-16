import { useLiveQuery } from 'dexie-react-hooks'
import { sleepMinutes } from '@/lib/sleep'
import { useData } from './DataProvider'
import type { LocalStore } from './store'
import type { SleepEntry } from './types'

/** All nights, newest first. undefined while loading. */
export function useSleep() {
  const { db } = useData()
  return useLiveQuery(async () => (await db.sleep_entries.toArray()).filter((s) => !s.deleted_at).sort((a, b) => b.wake_date.localeCompare(a.wake_date)), [db])
}

/**
 * Save the night that ended on `wakeDate` (one per morning). Re-uses that morning's row if it exists, even a
 * deleted one, because the server only allows one row per user per morning (same as weigh-ins).
 */
export async function saveSleep(store: LocalStore, wakeDate: string, v: { bed_time: string; wake_time: string; quality: number | null }): Promise<SleepEntry> {
  const values = { ...v, duration_min: sleepMinutes(v.bed_time, v.wake_time) }
  const existing = await store.db.sleep_entries.where('wake_date').equals(wakeDate).first()
  if (existing) return store.update('sleep_entries', existing.id, { ...values, deleted_at: null })
  return store.insert('sleep_entries', { wake_date: wakeDate, ...values })
}
