// Weights are stored in kg and shown in the user's unit (decision in CLAUDE.md).
export const KG_PER_LB = 0.45359237

export type WeightUnit = 'lb' | 'kg'

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}

/** Convert a stored kg value for display, rounded to `step` in the display unit (0.1 by default). */
export function displayWeight(kg: number, unit: WeightUnit, step = 0.1): number {
  const value = unit === 'lb' ? kgToLb(kg) : kg
  return Math.round(value / step) * step
}

/** Convert a value typed in the display unit to kg for storage (4 decimals, matching the database column). */
export function toStoredKg(value: number, unit: WeightUnit): number {
  const kg = unit === 'lb' ? lbToKg(value) : value
  return Math.round(kg * 10_000) / 10_000
}
