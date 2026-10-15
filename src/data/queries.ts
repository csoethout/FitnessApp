import { useLiveQuery } from 'dexie-react-hooks'
import { useData } from './DataProvider'
import type { Exercise, PlanTemplateDay, PlanTemplateExercise, WorkoutExercise, WorkoutSet } from './types'
import type { Suggestion } from '@/lib/progression'
import { activeWorkout, lastPerformance, planFor, suggestionFor } from './workouts'

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
  isMainLift: boolean // from the weekly plan, if the exercise is in it
  restSeconds: number
  repMin: number
  repMax: number
  suggestion: Suggestion // why today's sets were pre-filled the way they were
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
    // Main-lift flag, rest and rep range come from the weekly plan (any day that has the exercise).
    const items: WorkoutItem[] = []
    for (const [i, we] of wes.entries()) {
      const sets = live(await db.sets.where('workout_exercise_id').equals(we.id).toArray()).sort((a, b) => a.position - b.position)
      const plan = await planFor(db, exercises[i])
      const working = sets.filter((x) => x.set_type !== 'warmup').length || 3
      items.push({
        we, exercise: exercises[i], sets, last: await lastPerformance(db, we.exercise_id, workoutId),
        isMainLift: plan.isMainLift, restSeconds: plan.restSeconds, repMin: plan.repMin, repMax: plan.repMax,
        suggestion: await suggestionFor(db, exercises[i], we.exercise_id, working, plan, workoutId),
      })
    }
    return { workout, items }
  }, [db, workoutId])
}

/** The unfinished workout, if one is in progress. */
export function useActiveWorkout() {
  const { db } = useData()
  return useLiveQuery(() => activeWorkout(db), [db])
}

/** The default gym and the exercises marked "Not at this gym" there. undefined while loading. */
/** One gym (equipment profile) and its hidden exercises; the usual gym when no id. undefined while loading. */
export function useGym(gymId: string | undefined) {
  const { db } = useData()
  return useLiveQuery(async () => {
    const gyms = live(await db.equipment_profiles.toArray())
    const gym = (gymId ? gyms.find((g) => g.id === gymId) : gyms.find((p) => p.is_default)) ?? null
    const hidden = gym ? live(await db.exercise_unavailable.where('equipment_profile_id').equals(gym.id).toArray()) : []
    return { gym, unavailableIds: new Set(hidden.map((h) => h.exercise_id)) }
  }, [db, gymId])
}

export function useGyms() {
  const { db } = useData()
  return useLiveQuery(async () => live(await db.equipment_profiles.toArray()).sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name)), [db])
}

export function useMainGym() {
  const { db } = useData()
  return useLiveQuery(async () => {
    const gym = live(await db.equipment_profiles.toArray()).find((p) => p.is_default) ?? null
    const hidden = gym ? live(await db.exercise_unavailable.where('equipment_profile_id').equals(gym.id).toArray()) : []
    return { gym, unavailableIds: new Set(hidden.map((h) => h.exercise_id)) }
  }, [db])
}
