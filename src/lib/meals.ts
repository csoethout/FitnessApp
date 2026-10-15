// Saved meals and recipes (pure, unit tested). A saved meal is a list of foods with amounts; a recipe is the same
// thing that "makes N servings", so one portion = the whole list ÷ N. Logged as one entry per portion.
import { EXTRA_NUTRIENTS, foodCol, type ExtraKey } from './nutrition'

export type MealFood = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
} & Partial<Record<`${ExtraKey}_${'g' | 'mg'}`, number | null>>

export type PerPortion = { kcal: number; protein_g: number; carbs_g: number; fat_g: number; extras: Partial<Record<ExtraKey, number | null>> }

const r1 = (n: number) => Math.round(n * 10) / 10

/** Totals for one portion. Optional nutrients are only filled in when at least one food has them. */
export function mealPerPortion(items: { food: MealFood; servings: number }[], servingsYield: number): PerPortion {
  const n = servingsYield > 0 ? servingsYield : 1
  const sum = (pick: (f: MealFood) => number) => items.reduce((s, it) => s + pick(it.food) * it.servings, 0) / n
  const extras: PerPortion['extras'] = {}
  for (const x of EXTRA_NUTRIENTS) {
    const col = foodCol(x.key)
    const known = items.some((it) => typeof it.food[col] === 'number')
    extras[x.key] = known ? r1(sum((f) => f[col] ?? 0)) : null
  }
  return { kcal: Math.round(sum((f) => f.kcal)), protein_g: r1(sum((f) => f.protein_g)), carbs_g: r1(sum((f) => f.carbs_g)), fat_g: r1(sum((f) => f.fat_g)), extras }
}
