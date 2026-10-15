import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openLocalDb } from './db'
import { workoutHistory, workoutSummary } from './history'
import { LocalStore } from './store'
import { finishWorkout, startWorkout } from './workouts'

const USER = '00000000-0000-0000-0000-00000000000e'
let store: LocalStore
beforeEach(() => {
  store = new LocalStore(openLocalDb(`${USER}-${crypto.randomUUID()}`), USER)
})

async function session(weight: number, reps: number, startedAt: string) {
  const id = await startWorkout(store, 'Legs', [{ exercise_id: 'squat', sets: 2, rep_min: 6 }])
  await store.update('workouts', id, { started_at: startedAt })
  const we = (await store.db.workout_exercises.where('workout_id').equals(id).toArray())[0]
  const sets = (await store.db.sets.where('workout_exercise_id').equals(we.id).toArray()).sort((a, b) => a.position - b.position)
  await store.update('sets', sets[0].id, { weight_kg: weight, reps, completed_at: startedAt })
  await finishWorkout(store, id) // second set never done -> removed
  return id
}

describe('history and summary', () => {
  it('lists finished workouts newest first with totals', async () => {
    await session(100, 5, '2026-10-01T10:00:00Z')
    const second = await session(105, 5, '2026-10-08T10:00:00Z')
    const rows = await workoutHistory(store.db)
    expect(rows.map((r) => r.workout.id)[0]).toBe(second)
    expect(rows[0]).toMatchObject({ setCount: 1, volumeKg: 525, exerciseCount: 1 })
  })

  it('flags PRs against earlier sessions only, and first-time exercises', async () => {
    const first = await session(100, 5, '2026-10-01T10:00:00Z')
    const second = await session(105, 5, '2026-10-08T10:00:00Z')
    const s1 = await workoutSummary(store.db, first)
    expect(s1?.items[0]).toMatchObject({ firstTime: true, prs: [] })
    const s2 = await workoutSummary(store.db, second)
    expect(s2?.items[0].prs.map((p) => p.kind)).toEqual(['e1rm', 'weight'])
    expect(s2?.totals.prCount).toBe(2)
  })
})
