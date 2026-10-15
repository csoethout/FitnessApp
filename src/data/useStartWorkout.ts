import { useNavigate } from 'react-router'
import { useConfirm } from '@/components/ConfirmProvider'
import { useData } from './DataProvider'
import { activeWorkout, startWorkout, type PlannedExercise } from './workouts'

/**
 * Start a workout, unless one is already running, then open the logger. Exercises come from `planned` (today's
 * Plan my week session), else from the template day, else none (empty workout).
 */
export function useStartWorkout() {
  const { db, store } = useData()
  const navigate = useNavigate()
  const confirm = useConfirm()

  return async (templateDayId: string | null, name: string, fromPlan?: { exercises: PlannedExercise[]; weekPlanDayId: string | null }) => {
    const running = await activeWorkout(db)
    if (running) {
      const ok = await confirm({
        title: 'A workout is already in progress',
        message: `Finish or delete "${running.name ?? 'Workout'}" before starting another.`,
        confirmLabel: 'Open it',
      })
      if (ok) navigate(`/workout/${running.id}`)
      return
    }
    const planned = fromPlan
      ? fromPlan.exercises
      : templateDayId
      ? (await db.plan_template_exercises.where('template_day_id').equals(templateDayId).toArray())
          .filter((r) => !r.deleted_at)
          .sort((a, b) => a.position - b.position)
          .map((r) => ({ exercise_id: r.exercise_id, sets: r.sets, rep_min: r.rep_min, rep_max: r.rep_max }))
      : []
    const id = await startWorkout(store, name, planned, fromPlan?.weekPlanDayId ?? null)
    navigate(`/workout/${id}`)
  }
}
