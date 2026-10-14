// Runs only via `npm run test:sync` (supabase/tests/integration.sh), which starts Postgres + PostgREST.
import 'fake-indexeddb/auto'
import { createHmac } from 'node:crypto'
import { PostgrestClient } from '@supabase/postgrest-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { openLocalDb } from './db'
import { supabaseRemote } from './remote'
import { LocalStore } from './store'
import { SyncEngine } from './sync'

const url = process.env.POSTGREST_URL
const userId = process.env.TEST_USER_ID ?? ''

function jwt(secret: string, payload: object) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

describe.skipIf(!url)('sync against real PostgREST + RLS', () => {
  const token = jwt(process.env.JWT_SECRET ?? '', { sub: userId, role: 'authenticated', exp: 4102444800 })
  const client = new PostgrestClient(url!, { headers: { Authorization: `Bearer ${token}` } })
  const remote = supabaseRemote(client as unknown as SupabaseClient)

  it('pulls the exercise library across pages, pushes a workout, and round-trips server timestamps', async () => {
    const db = openLocalDb(`${userId}-${crypto.randomUUID()}`)
    const store = new LocalStore(db, userId)
    const engine = new SyncEngine(db, remote)

    expect(await engine.pull()).toBe('ok')
    const total = await db.exercises.count()
    expect(total).toBeGreaterThan(700)

    // Force small pages to exercise the keyset filter on rows sharing one updated_at.
    const page1 = await remote.pullPage('exercises', null, 100)
    const last = page1.data![99]
    const page2 = await remote.pullPage('exercises', { updated_at: last.updated_at, id: last.id }, 100)
    expect(page2.error).toBeNull()
    expect(page2.data!.length).toBe(100)
    expect(page2.data!.some((r) => page1.data!.some((p) => p.id === r.id))).toBe(false)

    const squat = (await db.exercises.where('name').equals('Barbell Squat').first())!
    const workout = await store.insert('workouts', {
      name: 'Legs', started_at: new Date().toISOString(), ended_at: null,
      week_plan_day_id: null, equipment_profile_id: null, notes: null,
    })
    const we = await store.insert('workout_exercises', {
      workout_id: workout.id, exercise_id: squat.id, position: 0, swapped_from_exercise_id: null, notes: null,
    })
    const set = await store.insert('sets', {
      workout_exercise_id: we.id, position: 0, set_type: 'working', weight_kg: 83.9146, reps: 8, rir: 2,
      completed_at: new Date().toISOString(),
    })

    expect(await engine.sync()).toBe('ok')
    expect(await db.outbox.count()).toBe(0)
    const server = await client.from('sets').select('*').eq('id', set.id).single()
    expect(server.data).toMatchObject({ reps: 8, weight_kg: 83.9146, user_id: userId })
    expect((await db.sets.get(set.id))?.updated_at).toBe(server.data.updated_at)

    // Edit + soft delete round trip.
    await store.update('sets', set.id, { reps: 9 })
    await store.remove('workout_exercises', we.id)
    expect(await engine.sync()).toBe('ok')
    const after = await client.from('sets').select('reps').eq('id', set.id).single()
    expect(after.data?.reps).toBe(9)

    // A row the server rejects (negative reps) is isolated, not retried forever.
    const bad = await store.insert('sets', {
      workout_exercise_id: we.id, position: 1, set_type: 'working', weight_kg: 80, reps: -1, rir: null, completed_at: null,
    })
    expect(await engine.sync()).toBe('ok')
    expect(await db.outbox.get(['sets', bad.id])).toMatchObject({ failed: true })
  })
})
