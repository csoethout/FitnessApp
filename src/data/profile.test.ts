import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { saveWeighIn } from './body'
import { openLocalDb } from './db'
import { loadPlanState, saveProfile, setGoal, setNutritionAdjust } from './profile'
import { LocalStore } from './store'

describe('nutrition plan state', () => {
  it('lists what is missing, then calculates from profile + goal + weight trend + nudges', async () => {
    const store = new LocalStore(openLocalDb(`p-${crypto.randomUUID()}`), 'user-p')
    expect((await loadPlanState(store.db, 'user-p', '2026-10-15')).missing).toEqual(['sex', 'birth date', 'height', 'activity', 'goal', 'weight'])

    await saveProfile(store, { sex: 'male', birth_date: '2003-04-21', height_cm: 195.6, activity_level: 'moderate' })
    expect((await store.db.profiles.get('user-p'))?.id).toBe('user-p') // keyed by the user id
    await setGoal(store, 'recomp', '2026-10-15', 95.25)
    await saveWeighIn(store, '2026-10-15', { weight_kg: 95.25, body_fat_pct: null, muscle_mass_kg: null })

    let s = await loadPlanState(store.db, 'user-p', '2026-10-15')
    expect(s.missing).toEqual([])
    expect(s.plan).toMatchObject({ kcal: 2700, protein_g: 200 })

    await setNutritionAdjust(store, { kcal: 100, protein_g: 0, fat_g: 0 })
    s = await loadPlanState(store.db, 'user-p', '2026-10-15')
    expect(s.plan?.kcal).toBe(2800)
    expect(s.base?.kcal).toBe(2700)

    // Changing the goal edits the one active goal (server allows one), and the nudge carries over.
    await setGoal(store, 'cut', '2026-10-15', 95.25)
    expect((await store.db.goals.toArray()).length).toBe(1)
    s = await loadPlanState(store.db, 'user-p', '2026-10-15')
    expect(s.plan?.kcal).toBe((s.base?.kcal ?? 0) + 100)
  })
})
