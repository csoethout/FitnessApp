// Rules-based nutrition plan (no AI): Mifflin-St Jeor → activity → goal → macros, with safety guardrails.
// Pure functions, unit tested. See CLAUDE.md → Calories.
import { carbsFromRemainder } from '../nutrition'

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'
export type GoalType = 'recomp' | 'cut' | 'bulk' | 'maintain' | 'strength'

export const ACTIVITY: Record<ActivityLevel, { factor: number; label: string; detail: string }> = {
  sedentary: { factor: 1.2, label: 'Mostly sitting', detail: 'Desk job, little exercise' },
  light: { factor: 1.375, label: 'Lightly active', detail: 'Training 1–3 days a week' },
  moderate: { factor: 1.55, label: 'Active', detail: 'Training 4–6 days a week, some walking' },
  very: { factor: 1.725, label: 'Very active', detail: 'Hard training most days plus an active job' },
  extra: { factor: 1.9, label: 'Extremely active', detail: 'Physical job plus hard training' },
}

/** Calories vs maintenance, protein (g per lb of body weight) and planned weekly weight change per goal. */
export const GOALS: Record<GoalType, { label: string; detail: string; calorieChange: number; proteinPerLb: number; ratePctWeek: number }> = {
  recomp: { label: 'Recomposition', detail: 'Lose fat and build muscle at the same time', calorieChange: -0.15, proteinPerLb: 0.95, ratePctWeek: -0.25 },
  cut: { label: 'Lose fat', detail: 'Steady fat loss, keeping muscle', calorieChange: -0.2, proteinPerLb: 1.0, ratePctWeek: -0.6 },
  maintain: { label: 'Maintain', detail: 'Keep your weight steady', calorieChange: 0, proteinPerLb: 0.8, ratePctWeek: 0 },
  strength: { label: 'Get stronger', detail: 'Maintenance calories with plenty of protein', calorieChange: 0.05, proteinPerLb: 0.85, ratePctWeek: 0.1 },
  bulk: { label: 'Build muscle', detail: 'Small surplus for slow, lean gain', calorieChange: 0.1, proteinPerLb: 0.85, ratePctWeek: 0.25 },
}

export const MAX_DEFICIT = 0.25 // never more than 25% under maintenance (CLAUDE.md)
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 }

export type PlanInputs = { sex: Sex; ageYears: number; heightCm: number; weightKg: number; activity: ActivityLevel; goal: GoalType }
export type Adjustments = { kcal: number; protein_g: number; fat_g: number }
export type NutritionPlan = {
  bmr: number
  tdee: number
  kcal: number
  protein_g: number
  fat_g: number
  carbs_g: number
  steps: string[] // plain-language explanation, shown to the user
  limited: string | null // set when a guardrail changed the result
}

const KG_PER_LB = 0.45359237
const round = (v: number, to: number) => Math.round(v / to) * to

export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === 'male' ? 5 : -161)
}

export function computePlan(i: PlanInputs, adj: Adjustments = { kcal: 0, protein_g: 0, fat_g: 0 }): NutritionPlan {
  const goal = GOALS[i.goal]
  const activity = ACTIVITY[i.activity]
  const bmr = mifflinStJeor(i.sex, i.weightKg, i.heightCm, i.ageYears)
  const tdee = bmr * activity.factor
  const weightLb = i.weightKg / KG_PER_LB

  const planKcal = round(tdee * (1 + goal.calorieChange), 50)
  const planProtein = round(Math.min(goal.proteinPerLb * weightLb, 300), 5)
  // Fat: at least 0.3 g per lb (hormone health), or 25% of calories when gaining.
  const planFat = round(Math.max(0.3 * weightLb, i.goal === 'bulk' ? (planKcal * 0.25) / 9 : 0), 5)

  // Your nudges ride on top of the plan, then the guardrails apply to the total.
  let kcal = planKcal + adj.kcal
  let limited: string | null = null
  const floor = Math.max(CALORIE_FLOOR[i.sex], Math.ceil((tdee * (1 - MAX_DEFICIT)) / 50) * 50)
  if (kcal < floor) {
    kcal = floor
    limited = `Calories held at ${floor.toLocaleString()} kcal: no more than 25% under maintenance and never below ${CALORIE_FLOOR[i.sex].toLocaleString()} kcal.`
  }
  const protein_g = Math.max(0, planProtein + adj.protein_g)
  const fat_g = Math.max(round(0.25 * weightLb, 5), planFat + adj.fat_g) // fat floor ~0.25 g/lb even when nudged
  const carbs_g = carbsFromRemainder(kcal, protein_g, fat_g)

  const pct = Math.round(goal.calorieChange * 100)
  const steps = [
    `Resting burn (Mifflin-St Jeor, ${i.sex}, ${i.ageYears} y, ${Math.round(i.heightCm)} cm, ${Math.round(weightLb)} lb): ${Math.round(bmr).toLocaleString()} kcal`,
    `× ${activity.factor} for "${activity.label}" = ${Math.round(tdee).toLocaleString()} kcal maintenance`,
    `${goal.label}: ${pct === 0 ? 'no change' : `${pct > 0 ? '+' : ''}${pct}%`} → ${planKcal.toLocaleString()} kcal`,
    `Protein ${goal.proteinPerLb} g per lb of body weight → ${planProtein} g; fat at least 0.3 g per lb → ${planFat} g; carbs fill the rest`,
  ]
  return { bmr, tdee, kcal, protein_g, fat_g, carbs_g, steps, limited }
}
