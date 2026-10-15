import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { STARTER_SPLIT } from '@/lib/starterSplit'
import { openLocalDb } from './db'
import { addSampleWeighIns, addSampleWorkouts, deleteAllWeighIns, deleteAllWorkouts } from './sample'
import { applyStarterSplit } from './setup'
import { LocalStore } from './store'
import type { Exercise } from './types'
import { startWorkout } from './workouts'

const USER = '00000000-0000-0000-0000-00000000000f'
let store: LocalStore

beforeEach(async () => {
  store = new LocalStore(openLocalDb(`${USER}-${crypto.randomUUID()}`), USER)
  const ids = [...new Set(STARTER_SPLIT.flatMap((d) => d.exercises.map((e) => e.sourceId)))]
  await store.db.exercises.bulkPut(
    ids.map((sid) => ({ id: `id-${sid}`, source_id: sid, name: sid, mechanic: 'compound', equipment: 'barbell', deleted_at: null }) as unknown as Exercise),
  )
  await applyStarterSplit(store, STARTER_SPLIT)
})

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

describe('sample data', () => {
  it('adds 6 weeks of plan-following workouts, then refuses to add them twice', async () => {
    const n = await addSampleWorkouts(store, 6, new Date(2026, 9, 15))
    expect(n).toBe(36) // 6 training days a week (Friday is rest) × 6 weeks
    const workouts = live(await store.db.workouts.toArray())
    expect(workouts.every((w) => w.ended_at && new Date(w.started_at) < new Date(2026, 9, 15))).toBe(true)
    expect(workouts.some((w) => new Date(w.started_at).getDay() === 5)).toBe(false) // no Friday workouts

    // Squat goes up 5 lb a week
    const squatWes = live(await store.db.workout_exercises.where('exercise_id').equals('id-Barbell_Squat').toArray())
    const firstSet = async (weId: string) => (await store.db.sets.where('workout_exercise_id').equals(weId).toArray()).find((s) => s.position === 0)!
    const weights = await Promise.all(squatWes.map(async (we) => Math.round((await firstSet(we.id)).weight_kg / 0.45359237)))
    expect(Math.min(...weights)).toBe(185)
    expect(Math.max(...weights)).toBe(210)

    await expect(addSampleWorkouts(store, 6, new Date(2026, 9, 15))).rejects.toThrow('already')
  })

  it('deletes every workout, including one in progress, but keeps the plan', async () => {
    await addSampleWorkouts(store, 2, new Date(2026, 9, 15))
    await startWorkout(store, 'Legs', [{ exercise_id: 'id-Barbell_Squat', sets: 2, rep_min: 6 }])
    const deleted = await deleteAllWorkouts(store)
    expect(deleted).toBe(13)
    expect(live(await store.db.workouts.toArray())).toEqual([])
    expect(live(await store.db.sets.toArray())).toEqual([])
    expect(live(await store.db.plan_template_exercises.toArray()).length).toBeGreaterThan(30)
  })
})

describe('sample weigh-ins', () => {
  it('adds most days, skips days already logged, and can delete them all', async () => {
    await store.insert('body_measurements', { measured_on: '2026-10-14', weight_kg: 90, body_fat_pct: null, muscle_mass_kg: null, note: null })
    const n = await addSampleWeighIns(store, 6, new Date(2026, 9, 15))
    expect(n).toBeGreaterThan(30)
    expect(n).toBeLessThan(42)
    const oct14 = (await store.db.body_measurements.where('measured_on').equals('2026-10-14').toArray())
    expect(oct14.length).toBe(1)
    expect(oct14[0].weight_kg).toBe(90) // untouched
    expect(await deleteAllWeighIns(store)).toBe(n + 1)
  })
})
