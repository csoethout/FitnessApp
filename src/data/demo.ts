// TESTING / DEMO TOOL: fills an EMPTY demo account with believable data in every part of the app, for showing it
// off. Refuses to run on an account that already has its own workouts or food. See Backlog (remove before sharing).
import { localDateKey } from '@/lib/body'
import { miToKm } from '@/lib/cardio'
import { addDaysKey } from '@/lib/nutrition'
import { STARTER_SPLIT } from '@/lib/starterSplit'
import { cardioTotals } from '@/lib/cardio'
import { saveSleep } from './sleep'
import { logWater } from './water'
import { createCustomFood, logFood, setTarget } from './food'
import { createMeal, loadMeals, logSavedMeal } from './meals'
import { loadPlanState, saveProfile, setGoal } from './profile'
import { addSampleWeighIns, addSampleWorkouts, SAMPLE_NOTE } from './sample'
import { applyStarterSplit } from './setup'
import type { LocalStore } from './store'
import type { Food, MealSlot } from './types'
import { ensureWeekPlan, setDay, weekStartOf } from './weekPlan'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

type FoodSpec = Parameters<typeof createCustomFood>[1]
const food = (name: string, serving_amount: number, serving_unit: string, serving_grams: number | null, kcal: number, protein_g: number, carbs_g: number, fat_g: number, extra: Partial<FoodSpec> = {}): FoodSpec => ({
  name, brand: null, serving_amount, serving_unit, serving_grams, kcal, protein_g, carbs_g, fat_g, fiber_g: null, barcode: null, ...extra,
})

/** Everyday high-protein foods (per serving, typical label values). */
const FOODS = {
  eggs: food('Eggs, large', 1, 'egg', 50, 70, 6, 0.5, 5, { cholesterol_mg: 185, sodium_mg: 70 }),
  oats: food('Rolled oats', 0.5, 'cup', 40, 150, 5, 27, 3, { fiber_g: 4 }),
  banana: food('Banana', 1, 'medium', 118, 105, 1.3, 27, 0.4, { fiber_g: 3.1, sugar_g: 14 }),
  chicken: food('Chicken breast, cooked', 100, 'g', 100, 165, 31, 0, 3.6, { sodium_mg: 74 }),
  rice: food('White rice, cooked', 1, 'cup', 158, 205, 4.3, 45, 0.4),
  broccoli: food('Broccoli', 1, 'cup', 91, 31, 2.5, 6, 0.3, { fiber_g: 2.4 }),
  yogurt: { ...food('Greek yogurt 0%', 1, 'container (170 g)', 170, 90, 18, 6, 0), brand: 'Fage' },
  whey: { ...food('Whey protein', 1, 'scoop', 32, 120, 24, 3, 1.5, { sodium_mg: 130 }), brand: 'Gold Standard' },
  salmon: food('Salmon fillet', 100, 'g', 100, 208, 20, 0, 13),
  beef: food('Ground beef 93% lean', 4, 'oz', 112, 170, 23, 0, 8, { sodium_mg: 75 }),
  beans: food('Kidney beans, canned', 0.5, 'cup', 130, 110, 7, 20, 0.5, { fiber_g: 6, sodium_mg: 340 }),
}

/** Small deterministic "randomness" so the demo looks lived-in but is the same every time. */
const wobble = (i: number, n: number) => ((i * 7919) % n) / n

export async function fillDemoAccount(store: LocalStore, now = new Date()): Promise<string> {
  const { db } = store
  const workouts = live(await db.workouts.toArray())
  if (workouts.some((w) => w.notes !== SAMPLE_NOTE) || live(await db.food_log_entries.toArray()).length) {
    throw new Error('This account already has its own workouts or food. The demo filler is only for an empty demo account.')
  }
  if (workouts.length) throw new Error('Demo data is already added.')
  const today = localDateKey(now)

  // 1. Weekly plan + usual gym, and a hotel gym for Plan my week's Away days.
  if (!live(await db.plan_templates.toArray()).some((t) => t.is_active)) await applyStarterSplit(store, STARTER_SPLIT)
  if (!live(await db.equipment_profiles.toArray()).some((g) => !g.is_default)) {
    await store.insert('equipment_profiles', { name: 'Hotel gym', equipment: ['dumbbell', 'machine', 'cable', 'body only'], is_default: false })
  }

  // 2. Six weeks of training and weigh-ins (slowly stronger, slowly leaner).
  const weighIns = await addSampleWeighIns(store, 6, now)
  const sessions = await addSampleWorkouts(store, 6, now)

  // 3. Profile + goal (started 15 days ago, so the 2-week calorie check-in shows) + the plan's targets.
  await saveProfile(store, { sex: 'male', birth_date: '1996-03-12', height_cm: 183, activity_level: 'moderate' })
  const goalStart = addDaysKey(today, -15)
  const state0 = await loadPlanState(db, store.userId, today)
  const goal = await setGoal(store, 'recomp', goalStart, state0.weightKg)
  const state = await loadPlanState(db, store.userId, today)
  if (state.plan) await setTarget(store, addDaysKey(today, -42), state.plan, 'initial', goal.id)

  // 4. Foods, a saved breakfast and a batch recipe, then 14 days of eating (+ today's breakfast).
  const f = {} as Record<keyof typeof FOODS, Food>
  for (const [key, spec] of Object.entries(FOODS)) f[key as keyof typeof FOODS] = await createCustomFood(store, spec)
  await createMeal(store, 'Usual breakfast', [
    { food_id: f.eggs.id, servings: 4 }, { food_id: f.oats.id, servings: 1.5 }, { food_id: f.banana.id, servings: 1 },
  ])
  await createMeal(store, 'Turkey-style beef chili', [{ food_id: f.beef.id, servings: 4 }, { food_id: f.beans.id, servings: 3 }], 3)
  const meals = await loadMeals(db)
  const breakfast = meals.find((m) => m.meal.name === 'Usual breakfast')!
  const chili = meals.find((m) => m.meal.name.includes('chili'))!
  let entries = 0
  const log = async (date: string, slot: MealSlot, food: Food, servings: number) => {
    await logFood(store, date, slot, food, servings)
    entries++
  }
  for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
    const date = addDaysKey(today, -daysAgo)
    await logSavedMeal(store, date, 'breakfast', breakfast, 1)
    entries++
    if (daysAgo === 0) break // today: just breakfast so far
    await log(date, 'lunch', f.chicken, 2.5 - (wobble(daysAgo, 3) > 0.6 ? 0.5 : 0))
    await log(date, 'lunch', f.rice, 1.5)
    await log(date, 'lunch', f.broccoli, 1)
    await log(date, 'snack', f.yogurt, 1)
    await log(date, 'snack', f.whey, 1)
    if (daysAgo % 3 === 0) {
      await logSavedMeal(store, date, 'dinner', chili, 1.5)
      entries++
      await log(date, 'dinner', f.rice, 1)
    } else {
      await log(date, 'dinner', f.salmon, 1.5 + (wobble(daysAgo, 4) > 0.5 ? 0.5 : 0))
      await log(date, 'dinner', f.rice, 1.5)
      await log(date, 'dinner', f.broccoli, 1)
    }
    if (wobble(daysAgo, 5) > 0.6) await log(date, 'snack', f.banana, 1)
  }

  // 5. Morning walks most days, a run on Fridays.
  let cardio = 0
  for (let daysAgo = 42; daysAgo >= 0; daysAgo--) {
    const date = addDaysKey(today, -daysAgo)
    const dow = new Date(date + 'T12:00:00').getDay()
    if (wobble(daysAgo, 7) > 0.85) continue // a missed morning now and then
    const run = dow === 5
    await store.insert('cardio_entries', {
      performed_on: date, activity: run ? 'run' : 'walk', notes: null,
      duration_min: run ? 25 : 20 + Math.round(wobble(daysAgo, 3) * 10),
      distance_km: miToKm(run ? 2.6 : 1 + Math.round(wobble(daysAgo, 5) * 5) / 10),
    })
    cardio++
  }

  // 6. Two weeks of water (a few bottles a day) and sleep (later on weekends), plus last night.
  for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
    const date = addDaysKey(today, -daysAgo)
    const bottles = daysAgo === 0 ? 2 : 3 + Math.round(wobble(daysAgo, 3) * 2)
    for (let b = 0; b < bottles; b++) await logWater(store, date, 24)
    if (daysAgo > 0 && wobble(daysAgo, 4) > 0.5) await logWater(store, date, 16)
    const weekend = [0, 6].includes(new Date(date + 'T12:00:00').getDay())
    const bedMin = 22 * 60 + 45 + Math.round(wobble(daysAgo, 5) * 60) + (weekend ? 45 : 0)
    const wake = weekend ? '07:45' : `06:${String(10 + Math.round(wobble(daysAgo, 6) * 30)).padStart(2, '0')}`
    const bed = `${String(Math.floor(bedMin / 60) % 24).padStart(2, '0')}:${String(bedMin % 60).padStart(2, '0')}`
    await saveSleep(store, date, { bed_time: bed, wake_time: wake, quality: 2 + Math.round(wobble(daysAgo, 7) * 3) })
  }

  // 7. Next week planned around a busy Tuesday, a short Thursday and a hotel on Saturday.
  const next = addDaysKey(weekStartOf(today), 7)
  const plan = await ensureWeekPlan(store, next)
  const days = live(await db.week_plan_days.where('week_plan_id').equals(plan.id).toArray())
  const hotel = live(await db.equipment_profiles.toArray()).find((g) => !g.is_default)
  const on = (offset: number) => days.find((d) => d.plan_date === addDaysKey(next, offset))!
  await setDay(store, on(2), { status: 'busy', minutes_available: null, equipment_profile_id: null })
  await setDay(store, on(4), { status: 'short', minutes_available: 30, equipment_profile_id: null })
  await setDay(store, on(6), { status: 'away', minutes_available: null, equipment_profile_id: hotel?.id ?? null })

  const mi = cardioTotals(live(await db.cardio_entries.toArray())).miles
  return `Demo ready: ${sessions} workouts, ${weighIns} weigh-ins, ${entries} food entries, ${cardio} walks/runs (${mi} mi), 2 weeks of water and sleep, saved meals, a hotel gym and next week planned.`
}
