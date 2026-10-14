import { useNavigate } from 'react-router'
import { useData } from './DataProvider'
import { activeWorkout, startWorkout } from './workouts'

/** Start a workout from a template day (or empty), unless one is already running, then open the logger. */
export function useStartWorkout() {
  const { db, store } = useData()
  const navigate = useNavigate()

  return async (templateDayId: string | null, name: string) => {
    const running = await activeWorkout(db)
    if (running) {
      if (confirm(`"${running.name ?? 'Workout'}" is still in progress. Open it instead?`)) navigate(`/workout/${running.id}`)
      return
    }
    const planned = templateDayId
      ? (await db.plan_template_exercises.where('template_day_id').equals(templateDayId).toArray())
          .filter((r) => !r.deleted_at)
          .sort((a, b) => a.position - b.position)
          .map((r) => ({ exercise_id: r.exercise_id, sets: r.sets, rep_min: r.rep_min }))
      : []
    const id = await startWorkout(store, name, planned)
    navigate(`/workout/${id}`)
  }
}
