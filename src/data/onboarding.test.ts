import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveFeatures } from '@/lib/features'
import { GYM_PRESETS } from '@/lib/gyms'
import { openLocalDb } from './db'
import { applySetup, loadSetupDefaults, saveFocus } from './onboarding'
import { LocalStore } from './store'
import type { Exercise } from './types'

// A slice of the real library (id, name, equipment) so the generated week finds its exercises.
function seedLibrary(store: LocalStore) {
  const rows: Exercise[] = []
  for (const line of readFileSync('supabase/migrations/20261015000000_seed_exercises.sql', 'utf8').split('\n')) {
    const flat = line.replace(/array\[[^\]]*\]/g, 'A').replace(/'\{\}'/g, 'A')
    const m = /^\('([^']+)', '((?:[^']|'')*)', A, A, (null|'[^']*'), (null|'[^']*'),/.exec(flat)
    if (!m) continue
    rows.push({
      id: `ex-${m[1]}`, owner_id: null, source: 'free-exercise-db', source_id: m[1], name: m[2], primary_muscles: [], secondary_muscles: [],
      equipment: m[3] === 'null' ? null : m[3].slice(1, -1), mechanic: m[4] === 'null' ? null : (m[4].slice(1, -1) as Exercise['mechanic']),
      force: null, level: 'beginner', category: 'strength', images: [], created_at: '', updated_at: '', deleted_at: null,
    })
  }
  return store.db.exercises.bulkPut(rows)
}

async function setup() {
  const store = new LocalStore(openLocalDb(`o-${crypto.randomUUID()}`), 'user-1')
  await seedLibrary(store)
  return store
}

describe('setup wizard', () => {
  it('saves profile, weigh-in, goal, gym, features and a generated week', async () => {
    const store = await setup()
    const { answers, hasWeek, hasWeight } = await loadSetupDefaults(store.db, store.userId, resolveFeatures(undefined))
    expect(hasWeek).toBe(false)
    expect(answers.sex).toBeNull() // nothing pre-filled about anyone
    await applySetup(store, {
      ...answers, name: 'Sam', sex: 'female', birthDate: '1995-06-01', heightIn: 66, weightLb: 150, goal: 'cut', days: [1, 2, 4, 5],
      minutes: 45, gymEquipment: GYM_PRESETS[2].equipment, features: { ...answers.features, food: false }, week: 'new',
    }, { hasWeight })

    const profile = (await store.db.profiles.get('user-1'))!
    expect(profile).toMatchObject({ display_name: 'Sam', sex: 'female', session_minutes_max: 45 })
    expect(profile.settings.features?.food).toBe(false)
    expect(profile.settings.setupDone).toBeTruthy()
    expect((await store.db.body_measurements.toArray())[0].weight_kg).toBeCloseTo(68.04, 1)
    expect((await store.db.goals.toArray())[0].goal_type).toBe('cut')
    expect((await store.db.equipment_profiles.toArray())[0]).toMatchObject({ is_default: true, equipment: GYM_PRESETS[2].equipment })

    const days = await store.db.plan_template_days.toArray()
    expect(days).toHaveLength(7)
    expect(days.filter((d) => !d.is_rest).map((d) => d.name).sort()).toEqual(['Lower A', 'Lower B', 'Upper A', 'Upper B'])
    const exercises = await store.db.plan_template_exercises.toArray()
    expect(exercises).toHaveLength(4 * 5)
    const equipment = new Map((await store.db.exercises.toArray()).map((e) => [e.id, e.equipment]))
    for (const e of exercises) expect(['dumbbell', 'body only', null]).toContain(equipment.get(e.exercise_id))
  })

  it('re-running keeps the week unless asked, and replaces it in place when asked', async () => {
    const store = await setup()
    const first = await loadSetupDefaults(store.db, store.userId, resolveFeatures(undefined))
    const base = { ...first.answers, sex: 'male' as const, birthDate: '1990-01-01', days: [1, 3, 5], week: 'new' as const, gymEquipment: GYM_PRESETS[0].equipment }
    await applySetup(store, base, { hasWeight: false })
    const dayIds = (await store.db.plan_template_days.toArray()).map((d) => d.id).sort()

    const again = await loadSetupDefaults(store.db, store.userId, resolveFeatures(undefined))
    expect(again.hasWeek).toBe(true)
    expect(again.answers.week).toBe('keep')
    expect(again.answers.days).toEqual([1, 3, 5])
    await applySetup(store, { ...again.answers, goal: 'bulk' }, { hasWeight: true })
    expect((await store.db.plan_template_exercises.toArray()).filter((e) => !e.deleted_at)).toHaveLength(3 * 6) // untouched

    await applySetup(store, { ...again.answers, days: [0, 2, 4, 6], week: 'new' }, { hasWeight: true })
    const days = await store.db.plan_template_days.toArray()
    expect(days.map((d) => d.id).sort()).toEqual(dayIds) // same rows, rewritten
    expect(days.filter((d) => !d.is_rest).map((d) => d.day_of_week).sort()).toEqual([0, 2, 4, 6])
    expect((await store.db.plan_templates.toArray()).filter((t) => t.is_active)).toHaveLength(1)
    expect((await store.db.plan_template_exercises.toArray()).filter((e) => !e.deleted_at)).toHaveLength(4 * 6)
    expect(await store.db.body_measurements.count()).toBe(1)
    expect((await store.db.goals.toArray()).map((g) => g.goal_type)).toEqual(['recomp']) // one goal row, changed in place
  })

  it('Body areas: skipping legs and rebuilding keeps the days but drops leg work', async () => {
    const store = await setup()
    const first = await loadSetupDefaults(store.db, store.userId, resolveFeatures(undefined))
    await applySetup(store, { ...first.answers, sex: 'male', birthDate: '1990-01-01', days: [1, 3, 5], week: 'new', gymEquipment: GYM_PRESETS[0].equipment }, { hasWeight: false })
    await saveFocus(store, { Legs: 'skip' }, false)
    expect((await store.db.profiles.get('user-1'))!.settings.trainFocus).toEqual({ Legs: 'skip' })
    expect((await store.db.plan_template_days.toArray()).map((d) => d.name)).toContain('Legs') // just saved

    await saveFocus(store, { Legs: 'skip' }, true)
    const days = (await store.db.plan_template_days.toArray()).filter((d) => !d.is_rest)
    expect(days.map((d) => d.day_of_week).sort()).toEqual([1, 3, 5])
    expect(days.map((d) => d.name).sort()).toEqual(['Pull', 'Push', 'Upper A'])
    const names = new Map((await store.db.exercises.toArray()).map((e) => [e.id, e.source_id]))
    const live = (await store.db.plan_template_exercises.toArray()).filter((e) => !e.deleted_at).map((e) => names.get(e.exercise_id))
    expect(live).not.toContain('Barbell_Squat')
    expect(live).not.toContain('Romanian_Deadlift')
  })
})
