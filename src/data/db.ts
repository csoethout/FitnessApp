import Dexie, { type EntityTable, type Table } from 'dexie'
import type { TableName, Tables } from './types'

/** A pending local change waiting to be pushed to Supabase. One entry per row (latest change wins). */
export type OutboxEntry = {
  table: TableName
  id: string
  version: string // changes on every write; a push only clears the entry if no newer edit arrived meanwhile
  queued_at: string
  attempts: number
  failed: boolean // the server rejected it (e.g. a constraint); kept so nothing is silently lost
  last_error: string | null
}

export type MetaEntry = { key: string; value: unknown }

export type LocalDb = Dexie & { [K in TableName]: EntityTable<Tables[K], 'id'> } & {
  outbox: Table<OutboxEntry, [TableName, string]> // primary key is the compound [table+id]
  meta: EntityTable<MetaEntry, 'key'>
}

/**
 * One IndexedDB database per signed-in user, so two accounts on the same phone never share local data.
 * Schema strings list the primary key first, then indexed fields (not every column).
 */
export function openLocalDb(userId: string): LocalDb {
  const db = new Dexie(`liftlog-${userId}`) as LocalDb
  db.version(1).stores({
    exercises: 'id, name, owner_id',
    equipment_profiles: 'id',
    exercise_unavailable: 'id, equipment_profile_id, exercise_id',
    user_exercise_settings: 'id, exercise_id',
    plan_templates: 'id',
    plan_template_days: 'id, template_id',
    plan_template_exercises: 'id, template_day_id',
    workouts: 'id, started_at',
    workout_exercises: 'id, workout_id, exercise_id',
    sets: 'id, workout_exercise_id',
    outbox: '[table+id], table',
    meta: 'key',
  })
  // v2 (Phase 4): weigh-ins. Dexie upgrades existing phones automatically; nothing is lost.
  db.version(2).stores({
    body_measurements: 'id, measured_on',
  })
  // v3 (Phase 4): food logging and targets.
  db.version(3).stores({
    foods: 'id, barcode, owner_id',
    saved_meals: 'id',
    saved_meal_items: 'id, saved_meal_id',
    food_log_entries: 'id, logged_on, food_id',
    nutrition_targets: 'id, effective_from',
  })
  return db
}
