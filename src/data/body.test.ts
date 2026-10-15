import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { deleteWeighIn, saveWeighIn } from './body'
import { openLocalDb } from './db'
import { LocalStore } from './store'

describe('weigh-ins', () => {
  it('keeps one row per day, updating and reviving it', async () => {
    const store = new LocalStore(openLocalDb(`w-${crypto.randomUUID()}`), 'u')
    const first = await saveWeighIn(store, '2026-10-15', { weight_kg: 95, body_fat_pct: null, muscle_mass_kg: null })
    const second = await saveWeighIn(store, '2026-10-15', { weight_kg: 94.8, body_fat_pct: 18.5, muscle_mass_kg: null })
    expect(second.id).toBe(first.id)
    await deleteWeighIn(store, first.id)
    const third = await saveWeighIn(store, '2026-10-15', { weight_kg: 94.6, body_fat_pct: null, muscle_mass_kg: 40 })
    expect(third).toMatchObject({ id: first.id, deleted_at: null, weight_kg: 94.6 })
    expect(await store.db.body_measurements.count()).toBe(1)
  })
})
