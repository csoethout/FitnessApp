import { useLiveQuery } from 'dexie-react-hooks'
import type { ExerciseSession } from '@/lib/progress'
import { useData } from './DataProvider'
import type { LocalDb } from './db'
import type { Exercise, WorkoutSet } from './types'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

/** Every exercise performed in every (non-deleted) workout, with its completed sets. Includes today's open workout. */
export async function loadSessions(db: LocalDb): Promise<{ sessions: ExerciseSession[]; exercises: Map<string, Exercise>; mainLiftIds: Set<string> }> {
  const workouts = new Map(live(await db.workouts.toArray()).map((w) => [w.id, w]))
  const wes = live(await db.workout_exercises.toArray()).filter((we) => workouts.has(we.workout_id))
  const setsByWe = new Map<string, WorkoutSet[]>()
  for (const s of live(await db.sets.toArray())) {
    if (!s.completed_at) continue
    setsByWe.set(s.workout_exercise_id, [...(setsByWe.get(s.workout_exercise_id) ?? []), s])
  }
  const exercises = new Map(
    (await db.exercises.bulkGet([...new Set(wes.map((we) => we.exercise_id))])).filter((e) => e !== undefined).map((e) => [e!.id, e!]),
  )
  const sessions: ExerciseSession[] = []
  for (const we of wes) {
    const sets = setsByWe.get(we.id)
    if (!sets?.length) continue
    sessions.push({
      exerciseId: we.exercise_id,
      workoutId: we.workout_id,
      startedAt: workouts.get(we.workout_id)!.started_at,
      primaryMuscles: exercises.get(we.exercise_id)?.primary_muscles ?? [],
      sets,
    })
  }
  // Main lifts in the active weekly plan are listed first on the Progress tab.
  const template = live(await db.plan_templates.toArray()).find((t) => t.is_active)
  const dayIds = template ? await db.plan_template_days.where('template_id').equals(template.id).primaryKeys() : []
  const planRows = dayIds.length ? live(await db.plan_template_exercises.where('template_day_id').anyOf(dayIds).toArray()) : []
  const mainLiftIds = new Set(planRows.filter((r) => r.is_main_lift).map((r) => r.exercise_id))
  return { sessions, exercises, mainLiftIds }
}

export function useProgressData() {
  const { db } = useData()
  return useLiveQuery(() => loadSessions(db), [db])
}
