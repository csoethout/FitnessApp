import type { LocalDb } from './db'
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from './types'
import { bestE1rm, findPRs, volumeKg, workingSetCount, type PR } from '@/lib/stats'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

export type HistoryRow = { workout: Workout; exerciseCount: number; setCount: number; volumeKg: number }

/** Finished workouts, newest first, with simple totals. */
export async function workoutHistory(db: LocalDb, limit?: number): Promise<HistoryRow[]> {
  const workouts = live(await db.workouts.toArray())
    .filter((w) => w.ended_at)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit)
  const rows: HistoryRow[] = []
  for (const workout of workouts) {
    const wes = live(await db.workout_exercises.where('workout_id').equals(workout.id).toArray())
    const sets = live(await db.sets.where('workout_exercise_id').anyOf(wes.map((w) => w.id)).toArray())
    rows.push({ workout, exerciseCount: wes.length, setCount: workingSetCount(sets), volumeKg: volumeKg(sets) })
  }
  return rows
}

/** All completed sets of an exercise from workouts that started before `before` (for PR comparisons). */
export async function setsBefore(db: LocalDb, exerciseId: string, before: string): Promise<WorkoutSet[]> {
  const wes = live(await db.workout_exercises.where('exercise_id').equals(exerciseId).toArray())
  const workouts = await db.workouts.bulkGet(wes.map((w) => w.workout_id))
  const earlier = wes.filter((_, i) => {
    const w = workouts[i]
    return w && !w.deleted_at && w.started_at < before
  })
  return live(await db.sets.where('workout_exercise_id').anyOf(earlier.map((w) => w.id)).toArray()).filter((s) => s.completed_at)
}

export type SummaryExercise = {
  we: WorkoutExercise
  exercise: Exercise | undefined
  sets: WorkoutSet[]
  bestE1rmKg: number | null
  prs: PR[]
  firstTime: boolean
}

export async function workoutSummary(db: LocalDb, workoutId: string) {
  const workout = await db.workouts.get(workoutId)
  if (!workout || workout.deleted_at) return null
  const wes = live(await db.workout_exercises.where('workout_id').equals(workoutId).toArray()).sort((a, b) => a.position - b.position)
  const exercises = await db.exercises.bulkGet(wes.map((w) => w.exercise_id))
  const items: SummaryExercise[] = []
  let allSets: WorkoutSet[] = []
  for (const [i, we] of wes.entries()) {
    const sets = live(await db.sets.where('workout_exercise_id').equals(we.id).toArray())
      .filter((s) => s.completed_at)
      .sort((a, b) => a.position - b.position)
    if (!sets.length) continue
    const before = await setsBefore(db, we.exercise_id, workout.started_at)
    items.push({ we, exercise: exercises[i], sets, bestE1rmKg: bestE1rm(sets), prs: findPRs(sets, before), firstTime: before.length === 0 })
    allSets = allSets.concat(sets)
  }
  return {
    workout,
    items,
    totals: { setCount: workingSetCount(allSets), volumeKg: volumeKg(allSets), prCount: items.reduce((n, it) => n + it.prs.length, 0) },
  }
}
