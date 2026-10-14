import { prefillSets } from '@/lib/logger'
import type { LocalDb } from './db'
import type { LocalStore } from './store'
import type { WorkoutSet } from './types'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

export type PlannedExercise = { exercise_id: string; sets: number; rep_min: number }

/** Sets from the most recent other workout that included this exercise and has completed sets. */
export async function lastPerformance(db: LocalDb, exerciseId: string, excludeWorkoutId?: string): Promise<WorkoutSet[]> {
  const wes = live(await db.workout_exercises.where('exercise_id').equals(exerciseId).toArray()).filter(
    (we) => we.workout_id !== excludeWorkoutId,
  )
  if (!wes.length) return []
  const workouts = await db.workouts.bulkGet(wes.map((we) => we.workout_id))
  const candidates = wes
    .map((we, i) => ({ we, workout: workouts[i] }))
    .filter((c) => c.workout && !c.workout.deleted_at)
    .sort((a, b) => b.workout!.started_at.localeCompare(a.workout!.started_at))
  for (const { we } of candidates) {
    const sets = live(await db.sets.where('workout_exercise_id').equals(we.id).toArray()).filter((s) => s.completed_at)
    if (sets.length) return sets
  }
  return []
}

/** The workout in progress (not finished, not deleted), if any. Only one at a time. */
export async function activeWorkout(db: LocalDb) {
  const open = live(await db.workouts.toArray()).filter((w) => !w.ended_at)
  return open.sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null
}

/** Create a workout with its exercises and planned sets pre-filled from last time. Returns the workout id. */
export async function startWorkout(store: LocalStore, name: string, planned: PlannedExercise[]): Promise<string> {
  const { db } = store
  return db.transaction('rw', [db.workouts, db.workout_exercises, db.sets, db.outbox], async () => {
    const workout = await store.insert('workouts', {
      name, started_at: new Date().toISOString(), ended_at: null, week_plan_day_id: null, equipment_profile_id: null, notes: null,
    })
    for (const [position, p] of planned.entries()) {
      await addExercise(store, workout.id, p, position)
    }
    return workout.id
  })
}

/** Add an exercise (with pre-filled sets) to a workout. */
export async function addExercise(store: LocalStore, workoutId: string, p: PlannedExercise, position: number) {
  const last = await lastPerformance(store.db, p.exercise_id, workoutId)
  const we = await store.insert('workout_exercises', {
    workout_id: workoutId, exercise_id: p.exercise_id, position, swapped_from_exercise_id: null, notes: null,
  })
  for (const [i, s] of prefillSets(p.sets, last, p.rep_min).entries()) {
    await store.insert('sets', {
      workout_exercise_id: we.id, position: i, set_type: 'working', weight_kg: s.weight_kg, reps: s.reps, rir: null, completed_at: null,
    })
  }
  return we
}

/** Add one more set, copying the previous set's weight and reps. */
export async function addSet(store: LocalStore, workoutExerciseId: string, after: WorkoutSet | undefined) {
  return store.insert('sets', {
    workout_exercise_id: workoutExerciseId,
    position: (after?.position ?? -1) + 1,
    set_type: 'working',
    weight_kg: after?.weight_kg ?? 0,
    reps: after?.reps ?? 8,
    rir: null,
    completed_at: null,
  })
}

/** Finish: stamp the end time and drop planned sets that were never done. */
export async function finishWorkout(store: LocalStore, workoutId: string) {
  const { db } = store
  await db.transaction('rw', [db.workouts, db.workout_exercises, db.sets, db.outbox], async () => {
    const wes = live(await db.workout_exercises.where('workout_id').equals(workoutId).toArray())
    for (const we of wes) {
      const sets = live(await db.sets.where('workout_exercise_id').equals(we.id).toArray())
      for (const s of sets) if (!s.completed_at) await store.remove('sets', s.id)
      if (!sets.some((s) => s.completed_at)) await store.remove('workout_exercises', we.id)
    }
    await store.update('workouts', workoutId, { ended_at: new Date().toISOString() })
  })
}

/** Throw the workout away (soft delete, so it disappears on every device). */
export async function discardWorkout(store: LocalStore, workoutId: string) {
  await store.remove('workouts', workoutId)
}
