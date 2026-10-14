import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { STARTER_SPLIT } from '@/lib/starterSplit'
import { openLocalDb } from './db'
import { applyStarterSplit } from './setup'
import { LocalStore } from './store'
import type { Exercise } from './types'

const USER = '00000000-0000-0000-0000-00000000000b'

async function storeWithLibrary(sourceIds: string[]) {
  const db = openLocalDb(`${USER}-${crypto.randomUUID()}`)
  await db.exercises.bulkPut(
    sourceIds.map((sid) => ({ id: `id-${sid}`, source_id: sid, name: sid, mechanic: 'compound', deleted_at: null }) as unknown as Exercise),
  )
  return new LocalStore(db, USER)
}

describe('applyStarterSplit', () => {
  const allIds = [...new Set(STARTER_SPLIT.flatMap((d) => d.exercises.map((e) => e.sourceId)))]

  it('creates the week, days, exercises and a default gym, all queued for sync', async () => {
    const store = await storeWithLibrary(allIds)
    const { missing } = await applyStarterSplit(store, STARTER_SPLIT)
    expect(missing).toEqual([])
    expect(await store.db.plan_templates.count()).toBe(1)
    expect(await store.db.plan_template_days.count()).toBe(7)
    expect(await store.db.plan_template_exercises.count()).toBe(STARTER_SPLIT.reduce((n, d) => n + d.exercises.length, 0))
    expect((await store.db.equipment_profiles.toArray())[0]).toMatchObject({ name: 'Main gym', is_default: true })
    const friday = (await store.db.plan_template_days.toArray()).find((d) => d.day_of_week === 5)
    expect(friday?.is_rest).toBe(true)
    expect(await store.db.outbox.count()).toBeGreaterThan(30)
  })

  it('does not create a second week if one exists', async () => {
    const store = await storeWithLibrary(allIds)
    await applyStarterSplit(store, STARTER_SPLIT)
    await applyStarterSplit(store, STARTER_SPLIT)
    expect(await store.db.plan_templates.count()).toBe(1)
    expect(await store.db.equipment_profiles.count()).toBe(1)
  })

  it('skips exercises missing from the library and reports them', async () => {
    const store = await storeWithLibrary(allIds.filter((id) => id !== 'Barbell_Squat'))
    const { missing } = await applyStarterSplit(store, STARTER_SPLIT)
    expect(missing).toEqual(['Barbell_Squat'])
  })

  it('every starter exercise exists in the real library', async () => {
    const { readFileSync } = await import('node:fs')
    const seed = readFileSync('supabase/migrations/20261015000000_seed_exercises.sql', 'utf8')
    for (const id of allIds) expect(seed, id).toContain(`('${id}',`)
  })
})
