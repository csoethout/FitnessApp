import { isBigJump, suggestNext, type Suggestion } from '@/lib/progression'
import { defaultRepRange, defaultRestSeconds } from '@/lib/training'
import type { WeightUnit } from '@/lib/units'
import type { LocalDb } from './db'
import type { LocalStore } from './store'
import type { Exercise, WorkoutSet } from './types'

/** Tables addExercise reads or writes: use inside any transaction that adds exercises to a workout. */
export const addExerciseTables = (db: LocalDb) => [db.workouts, db.workout_exercises, db.sets, db.outbox, db.exercises, db.plan_templates, db.plan_template_days, db.plan_template_exercises]

// The units setting arrives in step 5.4; the owner uses lb.
export const WEIGHT_UNIT: WeightUnit = 'lb'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

/** Rep range given when starting from a plan day; otherwise looked up in the plan (or the default for the exercise). */
export type PlannedExercise = { exercise_id: string; sets: number; rep_min?: number; rep_max?: number }

/** How the active weekly plan treats an exercise (any day that has it); defaults when it isn't in the plan. */
export async function planFor(db: LocalDb, exercise: Exercise | undefined) {
  const template = live(await db.plan_templates.toArray()).find((t) => t.is_active)
  const dayIds = template ? await db.plan_template_days.where('template_id').equals(template.id).primaryKeys() : []
  const rows = exercise && dayIds.length ? live(await db.plan_template_exercises.where('template_day_id').anyOf(dayIds).toArray()).filter((r) => r.exercise_id === exercise.id) : []
  const isMainLift = rows.some((r) => r.is_main_lift)
  const [defMin, defMax] = defaultRepRange(exercise?.mechanic ?? null)
  return {
    isMainLift,
    restSeconds: rows.find((r) => r.rest_seconds !== null)?.rest_seconds ?? defaultRestSeconds(isMainLift, exercise?.mechanic ?? null),
    repMin: rows[0]?.rep_min ?? defMin,
    repMax: rows[0]?.rep_max ?? defMax,
  }
}

/** This exercise's past sessions (completed sets, any type), most recent first, at most `n`. */
export async function recentSessions(db: LocalDb, exerciseId: string, n: number, excludeWorkoutId?: string): Promise<WorkoutSet[][]> {
  const wes = live(await db.workout_exercises.where('exercise_id').equals(exerciseId).toArray()).filter((we) => we.workout_id !== excludeWorkoutId)
  if (!wes.length) return []
  const workouts = await db.workouts.bulkGet(wes.map((we) => we.workout_id))
  const candidates = wes
    .map((we, i) => ({ we, workout: workouts[i] }))
    .filter((c) => c.workout && !c.workout.deleted_at)
    .sort((a, b) => b.workout!.started_at.localeCompare(a.workout!.started_at))
  const out: WorkoutSet[][] = []
  for (const { we } of candidates) {
    const sets = live(await db.sets.where('workout_exercise_id').equals(we.id).toArray()).filter((s) => s.completed_at)
    if (sets.length) out.push(sets)
    if (out.length >= n) break
  }
  return out
}

/** Today's suggestion for an exercise (double progression on the last two sessions). */
export async function suggestionFor(
  db: LocalDb, exercise: Exercise | undefined, exerciseId: string, sets: number, range: { repMin: number; repMax: number }, excludeWorkoutId?: string,
): Promise<Suggestion> {
  const sessions = await recentSessions(db, exerciseId, 2, excludeWorkoutId)
  return suggestNext({ sessions, sets, repMin: range.repMin, repMax: range.repMax, bigJump: isBigJump(exercise), unit: WEIGHT_UNIT })
}

/** Sets from the most recent other workout that included this exercise and has completed sets. */
export async function lastPerformance(db: LocalDb, exerciseId: string, excludeWorkoutId?: string): Promise<WorkoutSet[]> {
  return (await recentSessions(db, exerciseId, 1, excludeWorkoutId))[0] ?? []
}

/** The workout in progress (not finished, not deleted), if any. Only one at a time. */
export async function activeWorkout(db: LocalDb) {
  const open = live(await db.workouts.toArray()).filter((w) => !w.ended_at)
  return open.sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null
}

/** Create a workout with its exercises and sets pre-filled by the progression rules. Returns the workout id. */
export async function startWorkout(store: LocalStore, name: string, planned: PlannedExercise[], weekPlanDayId: string | null = null): Promise<string> {
  const { db } = store
  return db.transaction('rw', addExerciseTables(db), async () => {
    const workout = await store.insert('workouts', {
      name, started_at: new Date().toISOString(), ended_at: null, week_plan_day_id: weekPlanDayId, equipment_profile_id: null, notes: null,
    })
    for (const [position, p] of planned.entries()) {
      await addExercise(store, workout.id, p, position)
    }
    return workout.id
  })
}

/** Add an exercise to a workout, its sets pre-filled with today's suggestion (see src/lib/progression.ts). */
export async function addExercise(store: LocalStore, workoutId: string, p: PlannedExercise, position: number) {
  const exercise = await store.db.exercises.get(p.exercise_id)
  const plan = await planFor(store.db, exercise)
  const range = { repMin: p.rep_min ?? plan.repMin, repMax: p.rep_max ?? plan.repMax }
  const suggestion = await suggestionFor(store.db, exercise, p.exercise_id, p.sets, range, workoutId)
  const we = await store.insert('workout_exercises', {
    workout_id: workoutId, exercise_id: p.exercise_id, position, swapped_from_exercise_id: null, notes: null,
  })
  for (const [i, s] of suggestion.sets.entries()) {
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

/** Insert warm-up sets before the working sets of an exercise (positions shift down). */
export async function addWarmups(
  store: LocalStore,
  workoutExerciseId: string,
  plan: { weight_kg: number; reps: number }[],
) {
  const { db } = store
  await db.transaction('rw', [db.sets, db.outbox], async () => {
    const sets = live(await db.sets.where('workout_exercise_id').equals(workoutExerciseId).toArray())
    for (const s of sets) await store.update('sets', s.id, { position: s.position + plan.length })
    for (const [i, w] of plan.entries()) {
      await store.insert('sets', {
        workout_exercise_id: workoutExerciseId, position: i, set_type: 'warmup', weight_kg: w.weight_kg, reps: w.reps,
        rir: null, completed_at: null,
      })
    }
  })
}
