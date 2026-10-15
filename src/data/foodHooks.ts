import { useLiveQuery } from 'dexie-react-hooks'
import { targetOn } from '@/lib/nutrition'
import { useData } from './DataProvider'

/** A day's food log entries. undefined while loading. */
export function useDayLog(date: string) {
  const { db } = useData()
  return useLiveQuery(async () => (await db.food_log_entries.where('logged_on').equals(date).toArray()).filter((e) => !e.deleted_at), [db, date])
}

/** The target in effect on `date` (null if none set yet). undefined while loading. */
export function useTargetOn(date: string) {
  const { db } = useData()
  return useLiveQuery(async () => targetOn(await db.nutrition_targets.toArray(), date), [db, date])
}
