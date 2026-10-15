import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openLocalDb } from './db'
import { copyEntries, createCustomFood, logFood, logQuickAdd, recentFoods, setTarget } from './food'
import { LocalStore } from './store'

let store: LocalStore
beforeEach(() => {
  store = new LocalStore(openLocalDb(`f-${crypto.randomUUID()}`), 'user-1')
})

const chicken = () =>
  createCustomFood(store, {
    name: 'Chicken breast', brand: null, serving_amount: 4, serving_unit: 'oz', serving_grams: 113,
    kcal: 187, protein_g: 35, carbs_g: 0, fat_g: 4, fiber_g: null, barcode: null,
  })

describe('food log', () => {
  it('saves label foods as the user\'s own food and snapshots macros on the entry', async () => {
    const food = await chicken()
    expect(food).toMatchObject({ owner_id: 'user-1', source: 'custom' })
    const entry = await logFood(store, '2026-10-15', 'lunch', food, 1.5)
    await store.update('foods', food.id, { kcal: 999 }) // later correction
    expect((await store.db.food_log_entries.get(entry.id))?.kcal_per_serving).toBe(187)
  })

  it('copies yesterday (whole day or one meal) with new ids', async () => {
    const food = await chicken()
    await logFood(store, '2026-10-14', 'lunch', food, 1)
    await logQuickAdd(store, '2026-10-14', 'snack', { name: 'Protein bar', kcal: 200, protein_g: 20, carbs_g: 22, fat_g: 7 })
    expect(await copyEntries(store, '2026-10-14', '2026-10-15', 'lunch')).toBe(1)
    expect(await copyEntries(store, '2026-10-14', '2026-10-16')).toBe(2)
    const day = await store.db.food_log_entries.where('logged_on').equals('2026-10-16').toArray()
    expect(day.map((e) => e.name).sort()).toEqual(['Chicken breast', 'Protein bar'])
  })

  it('lists recent foods by how often they are eaten', async () => {
    const food = await chicken()
    for (const d of ['2026-10-10', '2026-10-12', '2026-10-14']) await logFood(store, d, 'lunch', food, 1.5)
    await logQuickAdd(store, '2026-10-13', 'snack', { name: 'Protein bar', kcal: 200, protein_g: 20, carbs_g: 0, fat_g: 0 })
    await logFood(store, '2026-07-01', 'lunch', food, 1) // too old
    const recent = await recentFoods(store.db, '2026-10-15')
    expect(recent.map((r) => [r.name, r.count])).toEqual([
      ['Chicken breast', 3],
      ['Protein bar', 1],
    ])
    expect(recent[0].lastServings).toBe(1.5)
  })

  it('keeps one target per start date', async () => {
    await setTarget(store, '2026-10-15', { kcal: 2700, protein_g: 200, carbs_g: 329, fat_g: 65 })
    await setTarget(store, '2026-10-15', { kcal: 2600, protein_g: 200, carbs_g: 304, fat_g: 65 })
    const rows = await store.db.nutrition_targets.toArray()
    expect(rows.length).toBe(1)
    expect(rows[0].kcal).toBe(2600)
  })
})
