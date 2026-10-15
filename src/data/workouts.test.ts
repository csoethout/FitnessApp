import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openLocalDb } from './db'
import { LocalStore } from './store'
import { activeWorkout, addSet, finishWorkout, startWorkout } from './workouts'

const USER = '00000000-0000-0000-0000-00000000000c'
let store: LocalStore

beforeEach(() => {
  store = new LocalStore(openLocalDb(`${USER}-${crypto.randomUUID()}`), USER)
})

async function setsOf(workoutId: string) {
  const wes = await store.db.workout_exercises.where('workout_id').equals(workoutId).toArray()
  const sets = await store.db.sets.where('workout_exercise_id').anyOf(wes.map((w) => w.id)).toArray()
  return sets.filter((s) => !s.deleted_at).sort((a, b) => a.position - b.position)
}

describe('workout flow', () => {
  it('starts with planned sets, finishes, and pre-fills the next session from it', async () => {
    const first = await startWorkout(store, 'Legs', [{ exercise_id: 'squat', sets: 3, rep_min: 6 }])
    expect(await activeWorkout(store.db)).toMatchObject({ id: first, name: 'Legs' })

    const planned = await setsOf(first)
    expect(planned.map((s) => s.reps)).toEqual([6, 6, 6])

    // Log two sets at 185 lb (83.9146 kg); the third is never done.
    await store.update('sets', planned[0].id, { weight_kg: 83.9146, reps: 8, completed_at: new Date().toISOString() })
    await store.update('sets', planned[1].id, { weight_kg: 83.9146, reps: 7, completed_at: new Date().toISOString() })
    await finishWorkout(store, first)

    expect(await activeWorkout(store.db)).toBeNull()
    expect((await setsOf(first)).length).toBe(2) // unfinished set removed

    const second = await startWorkout(store, 'Legs', [{ exercise_id: 'squat', sets: 3, rep_min: 6 }])
    const prefilled = await setsOf(second)
    expect(prefilled.map((s) => [s.weight_kg, s.reps])).toEqual([
      [83.9146, 8],
      [83.9146, 7],
      [83.9146, 7],
    ])
  })

  it('drops exercises with no completed sets when finishing', async () => {
    const id = await startWorkout(store, 'Chest', [
      { exercise_id: 'bench', sets: 1, rep_min: 6 },
      { exercise_id: 'fly', sets: 1, rep_min: 10 },
    ])
    const [benchSet] = await setsOf(id)
    await store.update('sets', benchSet.id, { completed_at: new Date().toISOString() })
    await finishWorkout(store, id)
    const wes = (await store.db.workout_exercises.where('workout_id').equals(id).toArray()).filter((w) => !w.deleted_at)
    expect(wes.length).toBe(1)
  })

  it('adds a set copying the previous one', async () => {
    const id = await startWorkout(store, 'Arms', [{ exercise_id: 'curl', sets: 1, rep_min: 10 }])
    const [s] = await setsOf(id)
    await store.update('sets', s.id, { weight_kg: 20, reps: 12 })
    const added = await addSet(store, s.workout_exercise_id, { ...s, weight_kg: 20, reps: 12 })
    expect(added).toMatchObject({ position: 1, weight_kg: 20, reps: 12, completed_at: null })
  })
})

describe('addWarmups', () => {
  it('puts warm-ups first and keeps working sets in order after them', async () => {
    const { addWarmups } = await import('./workouts')
    const id = await startWorkout(store, 'Legs', [{ exercise_id: 'squat', sets: 2, rep_min: 6 }])
    const [first] = await setsOf(id)
    await addWarmups(store, first.workout_exercise_id, [
      { weight_kg: 20, reps: 10 },
      { weight_kg: 50, reps: 5 },
    ])
    expect((await setsOf(id)).map((s) => [s.position, s.set_type])).toEqual([
      [0, 'warmup'],
      [1, 'warmup'],
      [2, 'working'],
      [3, 'working'],
    ])
  })
})
