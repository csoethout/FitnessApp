import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openLocalDb, type LocalDb } from './db'
import { FakeRemote } from './fakeRemote'
import { LocalStore } from './store'
import { SyncEngine } from './sync'

const USER = '00000000-0000-0000-0000-00000000000a'
let db: LocalDb
let remote: FakeRemote
let store: LocalStore
let engine: SyncEngine

beforeEach(() => {
  db = openLocalDb(`${USER}-${crypto.randomUUID()}`)
  remote = new FakeRemote()
  store = new LocalStore(db, USER)
  engine = new SyncEngine(db, remote)
})

async function logOneSet() {
  const workout = await store.insert('workouts', {
    name: 'Legs', started_at: new Date().toISOString(), ended_at: null,
    week_plan_day_id: null, equipment_profile_id: null, notes: null,
  })
  const we = await store.insert('workout_exercises', {
    workout_id: workout.id, exercise_id: 'squat', position: 0, swapped_from_exercise_id: null, notes: null,
  })
  const set = await store.insert('sets', {
    workout_exercise_id: we.id, position: 0, set_type: 'working', weight_kg: 83.9146, reps: 8, rir: 2,
    completed_at: new Date().toISOString(),
  })
  return { workout, we, set }
}

describe('local-first saving', () => {
  it('keeps sets on the phone while offline and pushes them once back online', async () => {
    remote.online = false
    const { set } = await logOneSet()

    expect(await db.sets.get(set.id)).toMatchObject({ reps: 8, user_id: USER })
    expect(await engine.sync()).toBe('offline')
    expect(await db.outbox.count()).toBe(3)
    const workoutEntry = (await db.outbox.where('table').equals('workouts').toArray())[0]
    expect(workoutEntry.attempts).toBe(1) // push stops at the first network failure and retries later

    remote.online = true
    expect(await engine.sync()).toBe('ok')
    expect(await db.outbox.count()).toBe(0)
    expect(remote.table('sets').get(set.id)).toMatchObject({ reps: 8, weight_kg: 83.9146 })
  })

  it('pushes parents before children even if the child was written first', async () => {
    const { set, we, workout } = await logOneSet()
    // Re-queue in reverse order: the outbox order must not matter.
    await store.update('sets', set.id, { reps: 9 })
    await store.update('workouts', workout.id, { notes: 'felt good' })
    expect(await engine.sync()).toBe('ok')
    expect(remote.table('workout_exercises').has(we.id)).toBe(true)
    expect(remote.table('sets').get(set.id)?.reps).toBe(9)
  })

  it('lets the server set updated_at, then pulls it back', async () => {
    const { set } = await logOneSet()
    await engine.sync()
    expect((await db.sets.get(set.id))?.updated_at).toBe(remote.table('sets').get(set.id)?.updated_at)
  })

  it('does not lose an edit made while a push is in flight', async () => {
    const { set } = await logOneSet()
    remote.onUpsert = async (table) => {
      if (table !== 'sets') return
      remote.onUpsert = null
      await store.update('sets', set.id, { reps: 10 }) // user taps + while the upload is running
    }
    await engine.push()
    expect(await db.outbox.get(['sets', set.id])).toBeDefined()
    await engine.sync()
    expect(remote.table('sets').get(set.id)?.reps).toBe(10)
    expect(await db.outbox.count()).toBe(0)
  })

  it('never overwrites an unsynced local edit with older server data', async () => {
    const { set } = await logOneSet()
    await engine.sync()
    remote.table('sets').set(set.id, { ...remote.table('sets').get(set.id)!, reps: 5, updated_at: remote.now() })
    await store.update('sets', set.id, { reps: 12 })
    await engine.pull()
    expect((await db.sets.get(set.id))?.reps).toBe(12)
  })

  it('isolates a row the server rejects so the rest still sync', async () => {
    const { we } = await logOneSet()
    await engine.sync()
    const ids = []
    for (let i = 1; i <= 3; i++) {
      const s = await store.insert('sets', {
        workout_exercise_id: we.id, position: i, set_type: 'working', weight_kg: 80, reps: i === 2 ? -1 : 8, rir: null,
        completed_at: null,
      })
      ids.push(s.id)
    }
    remote.reject = (table, row) => (table === 'sets' && (row.reps as number) < 0 ? { message: 'check violation', code: '23514' } : null)

    expect(await engine.sync()).toBe('ok')
    expect(remote.table('sets').has(ids[0])).toBe(true)
    expect(remote.table('sets').has(ids[2])).toBe(true)
    expect(await db.outbox.get(['sets', ids[1]])).toMatchObject({ failed: true, last_error: 'check violation' })

    await engine.discardFailed()
    expect(await db.outbox.count()).toBe(0)
  })

  it('syncs deletions as soft deletes', async () => {
    const { set } = await logOneSet()
    await engine.sync()
    await store.remove('sets', set.id)
    await engine.sync()
    expect(remote.table('sets').get(set.id)?.deleted_at).toBeTruthy()
  })
})

describe('pull', () => {
  it('pages through many rows that share one timestamp (like the exercise library)', async () => {
    const ts = remote.now()
    for (let i = 0; i < 2500; i++) {
      const id = `ex-${String(i).padStart(4, '0')}`
      remote.table('exercises').set(id, { id, name: `Exercise ${i}`, owner_id: null, updated_at: remote.now(true) || ts })
    }
    expect(await engine.pull()).toBe('ok')
    expect(await db.exercises.count()).toBe(2500)

    // A second pull only fetches what changed.
    remote.table('exercises').set('ex-0001', { id: 'ex-0001', name: 'Renamed', owner_id: null, updated_at: remote.now() })
    await engine.pull()
    expect((await db.exercises.get('ex-0001'))?.name).toBe('Renamed')
  })

  it('brings down data created on another device', async () => {
    remote.table('workouts').set('w-other', { id: 'w-other', user_id: USER, name: 'Chest', updated_at: remote.now() })
    await engine.sync()
    expect((await db.workouts.get('w-other'))?.name).toBe('Chest')
  })
})
