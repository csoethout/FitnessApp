import { MAIN_GYM_EQUIPMENT } from '@/lib/training'
import type { StarterDay } from '@/lib/starterSplit'
import type { LocalStore } from './store'

/** Make sure the user has a default equipment profile ("Main gym"). Returns its id. */
export async function ensureMainGym(store: LocalStore): Promise<string> {
  const existing = (await store.db.equipment_profiles.toArray()).find((p) => p.is_default && !p.deleted_at)
  if (existing) return existing.id
  const gym = await store.insert('equipment_profiles', { name: 'Main gym', equipment: MAIN_GYM_EQUIPMENT, is_default: true })
  return gym.id
}

/**
 * Create the user's weekly template from starter data. Does nothing if an active template already exists,
 * so tapping the button twice (or on two phones before syncing) can't create duplicate weeks.
 * Exercises missing from the library are skipped and returned so the UI can mention them.
 */
export async function applyStarterSplit(store: LocalStore, days: StarterDay[]): Promise<{ missing: string[] }> {
  const { db } = store
  // One transaction: the whole week appears at once (or not at all if something fails).
  return db.transaction(
    'rw',
    [db.plan_templates, db.plan_template_days, db.plan_template_exercises, db.equipment_profiles, db.exercises, db.outbox],
    () => createWeek(store, days),
  )
}

async function createWeek(store: LocalStore, days: StarterDay[]): Promise<{ missing: string[] }> {
  const { db } = store
  const active = (await db.plan_templates.toArray()).find((t) => t.is_active && !t.deleted_at)
  if (active) return { missing: [] }

  await ensureMainGym(store)
  const bySource = new Map((await db.exercises.toArray()).map((e) => [e.source_id, e]))
  const missing: string[] = []

  const template = await store.insert('plan_templates', { name: 'My week', split_type: 'custom', is_active: true, goal_id: null })
  for (const day of days) {
    const row = await store.insert('plan_template_days', {
      template_id: template.id, day_of_week: day.dayOfWeek, name: day.name, priority: day.priority, is_rest: !!day.rest,
    })
    let position = 0
    for (const ex of day.exercises) {
      const exercise = bySource.get(ex.sourceId)
      if (!exercise) {
        missing.push(ex.sourceId)
        continue
      }
      await store.insert('plan_template_exercises', {
        template_day_id: row.id, exercise_id: exercise.id, position: position++, sets: ex.sets,
        rep_min: ex.reps[0], rep_max: ex.reps[1], is_main_lift: !!ex.main, rest_seconds: null,
      })
    }
  }
  return { missing }
}

/** An empty week (all seven days, no exercises) for building from scratch. */
export async function applyBlankWeek(store: LocalStore): Promise<void> {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  await applyStarterSplit(
    store,
    names.map((name, dayOfWeek) => ({ dayOfWeek, name, priority: 1, exercises: [] })),
  )
}
