import type { LocalDb } from './db'
import type { LocalStore } from './store'
import { EXTRA_NUTRIENTS, entryCol, foodCol } from '@/lib/nutrition'
import { sameBarcode } from '@/lib/barcode'
import type { FoundFood } from '@/lib/foodSearch'
import { barcodeOff, barcodeUsda } from './foodApi'
import type { Food, FoodLogEntry, MealSlot } from './types'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

export const MEAL_SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: 'breakfast', label: 'Breakfast' },
  { slot: 'lunch', label: 'Lunch' },
  { slot: 'dinner', label: 'Dinner' },
  { slot: 'snack', label: 'Snacks' },
]

type PerServing = { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }

/** Copy a food's optional label lines onto a log entry (per serving). */
function extrasFromFood(food: Food) {
  return Object.fromEntries(
    EXTRA_NUTRIENTS.map((n) => [entryCol(n.key), (food as unknown as Record<string, number | null>)[foodCol(n.key)] ?? null]),
  ) as ExtraEntryCols
}

type ExtraEntryCols = Pick<
  FoodLogEntry,
  'fiber_g_per_serving' | 'sugar_g_per_serving' | 'sat_fat_g_per_serving' | 'trans_fat_g_per_serving' | 'cholesterol_mg_per_serving' | 'sodium_mg_per_serving'
>

const NO_EXTRAS: ExtraEntryCols = {
  fiber_g_per_serving: null, sugar_g_per_serving: null, sat_fat_g_per_serving: null, trans_fat_g_per_serving: null,
  cholesterol_mg_per_serving: null, sodium_mg_per_serving: null,
}

/** Log a food. The entry keeps its own copy of the food's macros and label lines (per serving). */
export function logFood(store: LocalStore, date: string, slot: MealSlot, food: Food, servings: number) {
  return store.insert('food_log_entries', {
    logged_on: date, meal_slot: slot, food_id: food.id, saved_meal_id: null, servings,
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    kcal_per_serving: food.kcal, protein_g_per_serving: food.protein_g, carbs_g_per_serving: food.carbs_g, fat_g_per_serving: food.fat_g,
    ...NO_EXTRAS,
    ...extrasFromFood(food),
  })
}

/** Log calories (and optionally macros) without a food — "Quick add". */
export function logQuickAdd(store: LocalStore, date: string, slot: MealSlot, m: PerServing) {
  return store.insert('food_log_entries', {
    logged_on: date, meal_slot: slot, food_id: null, saved_meal_id: null, servings: 1, name: m.name || 'Quick add',
    kcal_per_serving: m.kcal, protein_g_per_serving: m.protein_g, carbs_g_per_serving: m.carbs_g, fat_g_per_serving: m.fat_g,
    ...NO_EXTRAS,
  })
}

/** A food typed in from a nutrition label. Saved as the user's own food so it shows up in Recent. */
export function createCustomFood(
  store: LocalStore,
  f: Pick<Food, 'name' | 'brand' | 'serving_amount' | 'serving_unit' | 'serving_grams' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'barcode'> &
    Partial<Pick<Food, 'fiber_g' | 'sugar_g' | 'sat_fat_g' | 'trans_fat_g' | 'cholesterol_mg' | 'sodium_mg'>>,
) {
  return store.insert('foods', {
    fiber_g: null, sugar_g: null, sat_fat_g: null, trans_fat_g: null, cholesterol_mg: null, sodium_mg: null,
    ...f, source: 'custom', source_id: null,
  })
}

/** Copy one day's entries (or one meal's) to another day. Returns how many were copied. */
export async function copyEntries(store: LocalStore, from: string, to: string, slot?: MealSlot): Promise<number> {
  const { db } = store
  return db.transaction('rw', [db.food_log_entries, db.outbox], async () => {
    const src = live(await db.food_log_entries.where('logged_on').equals(from).toArray()).filter((e) => !slot || e.meal_slot === slot)
    for (const e of src) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, user_id, created_at, updated_at, deleted_at, ...copy } = e
      await store.insert('food_log_entries', { ...copy, logged_on: to })
    }
    return src.length
  })
}

/** Set the daily target from `date` onwards. One row per start date (server rule), so re-saving a day updates it. */
export async function setTarget(
  store: LocalStore,
  date: string,
  m: { kcal: number; protein_g: number; carbs_g: number; fat_g: number },
  reason: 'initial' | 'biweekly_adjust' | 'manual' = 'manual',
  goalId: string | null = null,
) {
  const existing = await store.db.nutrition_targets.where('effective_from').equals(date).first()
  const values = { kcal: Math.round(m.kcal), protein_g: Math.round(m.protein_g), carbs_g: Math.round(m.carbs_g), fat_g: Math.round(m.fat_g) }
  if (existing) return store.update('nutrition_targets', existing.id, { ...values, reason, goal_id: goalId, deleted_at: null })
  return store.insert('nutrition_targets', { ...values, effective_from: date, goal_id: goalId, reason })
}

export type RecentItem = PerServing & { key: string; food: Food | null; lastServings: number; count: number; last: string }

/**
 * Foods logged recently, most-used first (then most recent). Quick adds count too, grouped by name + calories.
 * This is the default view when adding food: the owner eats the same things a lot.
 */
export async function recentFoods(db: LocalDb, today: string, days = 45, limit = 30): Promise<RecentItem[]> {
  const entries = live(await db.food_log_entries.toArray()).filter((e) => e.logged_on <= today && e.logged_on >= shift(today, -days))
  const groups = new Map<string, FoodLogEntry[]>()
  for (const e of entries) {
    const key = e.food_id ?? `quick:${e.name}|${e.kcal_per_serving}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  const foods = new Map(
    (await db.foods.bulkGet([...new Set(entries.map((e) => e.food_id).filter((x): x is string => !!x))]))
      .filter((f): f is Food => !!f && !f.deleted_at)
      .map((f) => [f.id, f]),
  )
  return [...groups.entries()]
    .map(([key, list]) => {
      const latest = list.reduce((a, b) => (b.updated_at > a.updated_at ? b : a))
      const food = latest.food_id ? foods.get(latest.food_id) ?? null : null
      return {
        key, food, count: list.length, last: list.map((e) => e.logged_on).sort().at(-1)!, lastServings: latest.servings,
        name: latest.name,
        // Prefer the food's current numbers (if it was corrected), else the snapshot.
        kcal: food?.kcal ?? latest.kcal_per_serving,
        protein_g: food?.protein_g ?? latest.protein_g_per_serving,
        carbs_g: food?.carbs_g ?? latest.carbs_g_per_serving,
        fat_g: food?.fat_g ?? latest.fat_g_per_serving,
      }
    })
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit)
}

function shift(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number)
  const r = new Date(y, m - 1, d + days)
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`
}

/**
 * A food picked from search (or a barcode): re-use your copy if you've logged it before, else save it as your own
 * food. Your copy is a snapshot, so later edits to USDA / Open Food Facts don't change your history.
 */
export async function saveFoundFood(store: LocalStore, found: FoundFood): Promise<Food> {
  const mine = live(await store.db.foods.where('owner_id').equals(store.userId).toArray())
  const existing = mine.find((f) => f.source === found.source && f.source_id === found.source_id)
  if (existing) return existing
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { generic, ...row } = found
  return store.insert('foods', row)
}

export type BarcodeResult = { kind: 'mine'; food: Food } | { kind: 'found'; found: FoundFood } | { kind: 'notfound' } | { kind: 'offline' }

/**
 * Look up a scanned barcode: your own foods first (instant, offline), then USDA, then Open Food Facts.
 * "offline" means neither service could be reached (so we can't say it doesn't exist).
 */
export async function lookupBarcode(store: LocalStore, code: string, signal: AbortSignal): Promise<BarcodeResult> {
  const mine = live(await store.db.foods.where('owner_id').equals(store.userId).toArray()).find((f) => sameBarcode(f.barcode, code))
  if (mine) return { kind: 'mine', food: mine }
  let reached = false
  for (const source of [barcodeUsda, barcodeOff]) {
    try {
      const found = await source(code, signal)
      reached = true
      if (found) return { kind: 'found', found }
    } catch (err) {
      if (signal.aborted) throw err
    }
  }
  return reached ? { kind: 'notfound' } : { kind: 'offline' }
}
