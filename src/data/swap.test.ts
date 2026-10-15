import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openLocalDb } from './db'
import { LocalStore } from './store'
import { markUnavailable, replaceInPlan, restoreAvailable, swapInWorkout } from './swap'
import type { Exercise } from './types'
import { startWorkout } from './workouts'

const USER = '00000000-0000-0000-0000-00000000000d'
let store: LocalStore
const ex = (id: string): Exercise => ({ id, mechanic: 'compound', name: id, deleted_at: null }) as unknown as Exercise

beforeEach(() => {
  store = new LocalStore(openLocalDb(`${USER}-${crypto.randomUUID()}`), USER)
})

const liveWes = async (workoutId: string) =>
  (await store.db.workout_exercises.where('workout_id').equals(workoutId).toArray())
    .filter((w) => !w.deleted_at)
    .sort((a, b) => a.position - b.position)
const liveSets = async (weId: string) =>
  (await store.db.sets.where('workout_exercise_id').equals(weId).toArray()).filter((s) => !s.deleted_at)

describe('swapInWorkout', () => {
  it('replaces an untouched exercise in place', async () => {
    const id = await startWorkout(store, 'Legs', [
      { exercise_id: 'squat', sets: 3, rep_min: 6 },
      { exercise_id: 'curl', sets: 2, rep_min: 10 },
    ])
    const [squatWe] = await liveWes(id)
    await swapInWorkout(store, squatWe, ex('hack'))
    const wes = await liveWes(id)
    expect(wes.map((w) => w.exercise_id)).toEqual(['hack', 'curl'])
    expect(wes[0]).toMatchObject({ position: 0, swapped_from_exercise_id: 'squat' })
    expect((await liveSets(wes[0].id)).length).toBe(3)
  })

  it('keeps logged sets and continues the rest with the new exercise right after', async () => {
    const id = await startWorkout(store, 'Legs', [
      { exercise_id: 'squat', sets: 3, rep_min: 6 },
      { exercise_id: 'curl', sets: 2, rep_min: 10 },
    ])
    const [squatWe] = await liveWes(id)
    const [first] = (await liveSets(squatWe.id)).sort((a, b) => a.position - b.position)
    await store.update('sets', first.id, { completed_at: new Date().toISOString() })

    await swapInWorkout(store, squatWe, ex('hack'))
    const wes = await liveWes(id)
    expect(wes.map((w) => w.exercise_id)).toEqual(['squat', 'hack', 'curl'])
    expect((await liveSets(wes[0].id)).length).toBe(1) // the logged set stays with squat
    expect((await liveSets(wes[1].id)).length).toBe(2) // the 2 remaining sets move to hack squat
  })
})

describe('replaceInPlan', () => {
  it('swaps the exercise on every day, without duplicating it on a day that already has it', async () => {
    const t = await store.insert('plan_templates', { name: 'W', split_type: 'custom', is_active: true, goal_id: null })
    const mon = await store.insert('plan_template_days', { template_id: t.id, day_of_week: 1, name: 'Legs', priority: 1, is_rest: false })
    const sat = await store.insert('plan_template_days', { template_id: t.id, day_of_week: 6, name: 'Full', priority: 1, is_rest: false })
    const row = (day: string, exercise_id: string, position: number) =>
      store.insert('plan_template_exercises', {
        template_day_id: day, exercise_id, position, sets: 3, rep_min: 6, rep_max: 10, is_main_lift: false, rest_seconds: null,
      })
    await row(mon.id, 'squat', 0)
    await row(sat.id, 'squat', 0)
    await row(sat.id, 'hack', 1)

    await replaceInPlan(store, 'squat', 'hack')
    const rows = (await store.db.plan_template_exercises.toArray()).filter((r) => !r.deleted_at)
    expect(rows.filter((r) => r.template_day_id === mon.id).map((r) => r.exercise_id)).toEqual(['hack'])
    expect(rows.filter((r) => r.template_day_id === sat.id).map((r) => r.exercise_id)).toEqual(['hack'])
  })
})

describe('Not at this gym', () => {
  it('hides, restores and hides again using the same row', async () => {
    await markUnavailable(store, 'gym', 'squat')
    await markUnavailable(store, 'gym', 'squat')
    await restoreAvailable(store, 'gym', 'squat')
    await markUnavailable(store, 'gym', 'squat')
    const rows = await store.db.exercise_unavailable.toArray()
    expect(rows.length).toBe(1)
    expect(rows[0].deleted_at).toBeNull()
  })
})
