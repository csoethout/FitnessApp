import type { LocalStore } from './store'
import type { Exercise, WorkoutExercise } from './types'
import { addExercise, addExerciseTables } from './workouts'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

/**
 * Swap an exercise inside a workout.
 * - Nothing logged yet: replace it in place and re-fill its sets from the new exercise's history.
 * - Some sets already logged: keep those under the old exercise and continue the remaining sets
 *   with the new exercise in a new card right after it.
 */
export async function swapInWorkout(store: LocalStore, we: WorkoutExercise, next: Exercise) {
  const { db } = store
  await db.transaction('rw', addExerciseTables(db), async () => {
    const sets = live(await db.sets.where('workout_exercise_id').equals(we.id).toArray())
    const pending = sets.filter((s) => !s.completed_at && s.set_type !== 'warmup')
    for (const s of sets.filter((s) => !s.completed_at)) await store.remove('sets', s.id)

    const siblings = live(await db.workout_exercises.where('workout_id').equals(we.workout_id).toArray())
    const done = sets.some((s) => s.completed_at)
    if (!done) await store.remove('workout_exercises', we.id)

    // Shift later exercises down one slot if the new card goes after a kept one.
    const position = done ? we.position + 1 : we.position
    if (done) {
      for (const sib of siblings.filter((s) => s.position > we.position)) {
        await store.update('workout_exercises', sib.id, { position: sib.position + 1 })
      }
    }
    const added = await addExercise(
      store,
      we.workout_id,
      { exercise_id: next.id, sets: Math.max(1, pending.length || 3) },
      position,
    )
    await store.update('workout_exercises', added.id, { swapped_from_exercise_id: we.exercise_id })
  })
}

/**
 * Replace an exercise everywhere in the active weekly plan (all days). If a day already contains
 * the new exercise, the old one is just removed from that day.
 */
export async function replaceInPlan(store: LocalStore, oldId: string, newId: string) {
  const { db } = store
  await db.transaction('rw', [db.plan_templates, db.plan_template_days, db.plan_template_exercises, db.outbox], async () => {
    const template = live(await db.plan_templates.toArray()).find((t) => t.is_active)
    if (!template) return
    const days = live(await db.plan_template_days.where('template_id').equals(template.id).toArray())
    for (const day of days) {
      const rows = live(await db.plan_template_exercises.where('template_day_id').equals(day.id).toArray())
      const hasNew = rows.some((r) => r.exercise_id === newId)
      for (const r of rows.filter((r) => r.exercise_id === oldId)) {
        if (hasNew) await store.remove('plan_template_exercises', r.id)
        else await store.update('plan_template_exercises', r.id, { exercise_id: newId })
      }
    }
  })
}

/** Hide an exercise at a gym ("Not at this gym"). Re-uses an earlier row so the server's unique rule holds. */
export async function markUnavailable(store: LocalStore, gymId: string, exerciseId: string) {
  const existing = (await store.db.exercise_unavailable.where('exercise_id').equals(exerciseId).toArray()).find(
    (r) => r.equipment_profile_id === gymId,
  )
  if (existing) {
    if (existing.deleted_at) await store.update('exercise_unavailable', existing.id, { deleted_at: null })
    return
  }
  await store.insert('exercise_unavailable', { equipment_profile_id: gymId, exercise_id: exerciseId })
}

export async function restoreAvailable(store: LocalStore, gymId: string, exerciseId: string) {
  const rows = (await store.db.exercise_unavailable.where('exercise_id').equals(exerciseId).toArray()).filter(
    (r) => r.equipment_profile_id === gymId && !r.deleted_at,
  )
  for (const r of rows) await store.remove('exercise_unavailable', r.id)
}
