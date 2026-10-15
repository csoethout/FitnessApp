import { checkMacros, macroKcal } from './nutrition'

/** kcalTyped: you've typed in the calories field (it then stops following the macros, even if emptied mid-edit). */
export type MacroValues = { kcal: number | null; kcalTyped: boolean; protein: number | null; carbs: number | null; fat: number | null }
export const EMPTY_MACROS: MacroValues = { kcal: null, kcalTyped: false, protein: null, carbs: null, fat: null }

/** Calories implied by the macros, or null when none entered. */
export function calculatedKcal(v: MacroValues): number | null {
  if (v.protein === null && v.carbs === null && v.fat === null) return null
  return Math.round(macroKcal(v.protein ?? 0, v.carbs ?? 0, v.fat ?? 0))
}

/** Calories saved: what you typed, or (until you type, or if you clear it) the calories implied by the macros. */
export function effectiveKcal(v: MacroValues): number | null {
  return v.kcalTyped && v.kcal !== null ? v.kcal : calculatedKcal(v)
}

/** True when the entry can be saved: calories known and macros not more than the calories allow. */
export function macrosValid(v: MacroValues): boolean {
  const kcal = effectiveKcal(v)
  return kcal !== null && checkMacros(kcal, v.protein ?? 0, v.carbs ?? 0, v.fat ?? 0).status !== 'over'
}
