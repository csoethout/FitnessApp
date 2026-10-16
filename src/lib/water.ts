// Water helpers (pure, unit tested). Amounts are stored in ml and shown in US fluid ounces.
export const ML_PER_OZ = 29.5735
export const ozToMl = (oz: number) => Math.round(oz * ML_PER_OZ * 10) / 10
export const mlToOz = (ml: number) => ml / ML_PER_OZ

export const DEFAULT_GOAL_OZ = 96
export const DEFAULT_BOTTLE_OZ = 24

/**
 * Suggested daily water: about 35 ml per kg of body weight (a common rule of thumb, not medical advice),
 * rounded to the nearest 8 oz glass, between 64 and 160 oz. No weight yet → 96 oz.
 */
export function suggestedGoalOz(weightKg: number | null): number {
  if (!weightKg || weightKg <= 0) return DEFAULT_GOAL_OZ
  const oz = mlToOz(weightKg * 35)
  return Math.min(160, Math.max(64, Math.round(oz / 8) * 8))
}

/** Total for a day's entries, in whole oz. */
export function totalOz(entries: { amount_ml: number }[]): number {
  return Math.round(mlToOz(entries.reduce((s, e) => s + e.amount_ml, 0)))
}

/** Share of the goal reached, 0–1 (capped). */
export const waterProgress = (oz: number, goalOz: number) => (goalOz > 0 ? Math.min(1, oz / goalOz) : 0)
