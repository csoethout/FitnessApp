import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { openLocalDb } from './db'
import { saveSleep } from './sleep'
import { LocalStore } from './store'

describe('saveSleep', () => {
  it('keeps one row per morning, re-using a deleted one (server unique rule)', async () => {
    const store = new LocalStore(openLocalDb(`s-${crypto.randomUUID()}`), 'user-1')
    const a = await saveSleep(store, '2026-10-16', { bed_time: '23:00', wake_time: '07:00', quality: null })
    expect(a.duration_min).toBe(480)
    await store.remove('sleep_entries', a.id)
    const b = await saveSleep(store, '2026-10-16', { bed_time: '00:30', wake_time: '06:00', quality: 2 })
    expect(b.id).toBe(a.id)
    expect(b.deleted_at).toBeNull()
    expect(b.duration_min).toBe(330)
    expect(await store.db.sleep_entries.count()).toBe(1)
  })
})
