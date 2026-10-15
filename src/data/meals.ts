import { useLiveQuery } from 'dexie-react-hooks'
import { mealPerPortion, type PerPortion } from '@/lib/meals'
import { EXTRA_NUTRIENTS, entryCol } from '@/lib/nutrition'
import { useData } from './DataProvider'
import type { LocalDb } from './db'
import type { LocalStore } from './store'
import type { Food, FoodLogEntry, MealSlot, SavedMeal, SavedMealItem } from './types'

export type MealItemView = { item: SavedMealItem; food: Food }
export type MealView = { meal: SavedMeal; items: MealItemView[]; per: PerPortion }

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

/** All saved meals with their foods and per-portion totals, most recently changed first. */
export async function loadMeals(db: LocalDb): Promise<MealView[]> {
  const [meals, items, foods] = await Promise.all([db.saved_meals.toArray(), db.saved_meal_items.toArray(), db.foods.toArray()])
  const foodById = new Map(foods.map((f) => [f.id, f]))
  return live(meals)
    .map((meal) => {
      const list = live(items)
        .filter((i) => i.saved_meal_id === meal.id)
        .sort((a, b) => a.position - b.position)
        .flatMap((item) => {
          const food = foodById.get(item.food_id)
          return food ? [{ item, food }] : []
        })
      return { meal, items: list, per: mealPerPortion(list.map((x) => ({ food: x.food, servings: x.item.servings })), meal.servings_yield) }
    })
    .sort((a, b) => b.meal.updated_at.localeCompare(a.meal.updated_at))
}

export function useSavedMeals() {
  const { db } = useData()
  return useLiveQuery(() => loadMeals(db), [db])
}

export function useSavedMeal(id: string | undefined) {
  const { db } = useData()
  return useLiveQuery(async () => (await loadMeals(db)).find((m) => m.meal.id === id) ?? null, [db, id])
}

/** Create a meal from foods and amounts (all in one go, so a half-saved meal can't sync). */
export async function createMeal(store: LocalStore, name: string, items: { food_id: string; servings: number }[], servingsYield = 1) {
  const { db } = store
  return db.transaction('rw', [db.saved_meals, db.saved_meal_items, db.outbox], async () => {
    const meal = await store.insert('saved_meals', { name, servings_yield: servingsYield, notes: null })
    for (const [i, it] of items.entries()) {
      await store.insert('saved_meal_items', { saved_meal_id: meal.id, food_id: it.food_id, servings: it.servings, position: i })
    }
    return meal
  })
}

/** "Save as meal" from a meal on the day. Quick adds have no food behind them, so they're left out. */
export async function saveEntriesAsMeal(store: LocalStore, name: string, entries: FoodLogEntry[]) {
  const withFood = entries.filter((e): e is FoodLogEntry & { food_id: string } => !!e.food_id)
  const meal = await createMeal(store, name, withFood.map((e) => ({ food_id: e.food_id, servings: e.servings })))
  return { meal, skipped: entries.length - withFood.length }
}

/** Log portions of a saved meal as one entry, with a snapshot of its per-portion numbers (like any food). */
export function logSavedMeal(store: LocalStore, date: string, slot: MealSlot, m: MealView, portions: number) {
  return store.insert('food_log_entries', {
    logged_on: date, meal_slot: slot, food_id: null, saved_meal_id: m.meal.id, servings: portions, name: m.meal.name,
    kcal_per_serving: m.per.kcal, protein_g_per_serving: m.per.protein_g, carbs_g_per_serving: m.per.carbs_g, fat_g_per_serving: m.per.fat_g,
    ...(Object.fromEntries(EXTRA_NUTRIENTS.map((x) => [entryCol(x.key), m.per.extras[x.key] ?? null])) as Pick<
      FoodLogEntry,
      'fiber_g_per_serving' | 'sugar_g_per_serving' | 'sat_fat_g_per_serving' | 'trans_fat_g_per_serving' | 'cholesterol_mg_per_serving' | 'sodium_mg_per_serving'
    >),
  })
}

/** Add a food to a meal; if it's already in there, its amount goes up instead of a second row. */
export async function addMealItem(store: LocalStore, m: MealView, food: Food, servings: number) {
  const existing = m.items.find((x) => x.food.id === food.id)
  if (existing) {
    await store.update('saved_meal_items', existing.item.id, { servings: existing.item.servings + servings })
    return
  }
  const position = m.items.reduce((p, x) => Math.max(p, x.item.position + 1), 0)
  await store.insert('saved_meal_items', { saved_meal_id: m.meal.id, food_id: food.id, servings, position })
  await store.update('saved_meals', m.meal.id, {}) // bump updated_at so it sorts first
}

/** Delete a meal and its items. Days you already logged keep their entries (they're snapshots). */
export async function deleteMeal(store: LocalStore, m: MealView) {
  const { db } = store
  await db.transaction('rw', [db.saved_meals, db.saved_meal_items, db.outbox], async () => {
    for (const x of m.items) await store.remove('saved_meal_items', x.item.id)
    await store.remove('saved_meals', m.meal.id)
  })
}
