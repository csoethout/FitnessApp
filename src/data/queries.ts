import { useLiveQuery } from 'dexie-react-hooks'
import { useData } from './DataProvider'
import type { Exercise, PlanTemplateDay, PlanTemplateExercise, WorkoutExercise, WorkoutSet } from './types'
import { activeWorkout, lastPerformance } from './workouts'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

/** The active weekly template and its 7 days (Sunday first). undefined while loading. */
export function useActiveWeek() {
  const { db } = useData()
  return useLiveQuery(async () => {
    const template = live(await db.plan_templates.toArray()).find((t) => t.is_active) ?? null
    if (!template) return { template: null, days: [] as PlanTemplateDay[] }
    const days = live(await db.plan_template_days.where('template_id').equals(template.id).toArray())
    return { template, days: days.sort((a, b) => a.day_of_week - b.day_of_week) }
  }, [db])
}

export type DayExercise = PlanTemplateExercise & { exercise: Exercise | undefined }

/** One template day with its exercises (in order), joined to the exercise library. */
export function useTemplateDay(dayId: string | undefined) {
  const { db } = useData()
  return useLiveQuery(async () => {
    if (!dayId) return null
    const day = await db.plan_template_days.get(dayId)
    if (!day || day.deleted_at) return null
    const rows = live(await db.plan_template_exercises.where('template_day_id').equals(dayId).toArray())
    rows.sort((a, b) => a.position - b.position)
    const exercises = await db.exercises.bulkGet(rows.map((r) => r.exercise_id))
    return { day, items: rows.map((r, i): DayExercise => ({ ...r, exercise: exercises[i] })) }
  }, [db, dayId])
}

/** Exercise counts per template day, for the week overview. */
export function useDayExerciseCounts(dayIds: string[]) {
  const { db } = useData()
  return useLiveQuery(async () => {
    const rows = live(await db.plan_template_exercises.where('template_day_id').anyOf(dayIds).toArray())
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.template_day_id, (counts.get(r.template_day_id) ?? 0) + 1)
    return counts
  }, [db, dayIds.join(',')])
}

export type WorkoutItem = {
  we: WorkoutExercise
  exercise: Exercise | undefined
  sets: WorkoutSet[]
  last: WorkoutSet[]
}

/** A workout with its exercises (ordered), their sets (ordered), and what was done last time. */
export function useWorkout(workoutId: string | undefined) {
  const { db } = useData()
  return useLiveQuery(async () => {
    if (!workoutId) return null
    const workout = await db.workouts.get(workoutId)
    if (!workout || workout.deleted_at) return null
    const wes = live(await db.workout_exercises.where('workout_id').equals(workoutId).toArray()).sort((a, b) => a.position - b.position)
    const exercises = await db.exercises.bulkGet(wes.map((we) => we.exercise_id))
    const items: WorkoutItem[] = []
    for (const [i, we] of wes.entries()) {
      const sets = live(await db.sets.where('workout_exercise_id').equals(we.id).toArray()).sort((a, b) => a.position - b.position)
      items.push({ we, exercise: exercises[i], sets, last: await lastPerformance(db, we.exercise_id, workoutId) })
    }
    return { workout, items }
  }, [db, workoutId])
}

/** The unfinished workout, if one is in progress. */
export function useActiveWorkout() {
  const { db } = useData()
  return useLiveQuery(() => activeWorkout(db), [db])
}
