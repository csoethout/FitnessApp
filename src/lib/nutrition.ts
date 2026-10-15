// Nutrition maths (pure, unit tested).

export type Macros = { kcal: number; protein_g: number; carbs_g: number; fat_g: number }
export type EntryLike = {
  servings: number
  kcal_per_serving: number
  protein_g_per_serving: number
  carbs_g_per_serving: number
  fat_g_per_serving: number
}

export const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

export function entryMacros(e: EntryLike): Macros {
  return {
    kcal: e.kcal_per_serving * e.servings,
    protein_g: e.protein_g_per_serving * e.servings,
    carbs_g: e.carbs_g_per_serving * e.servings,
    fat_g: e.fat_g_per_serving * e.servings,
  }
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, protein_g: a.protein_g + m.protein_g, carbs_g: a.carbs_g + m.carbs_g, fat_g: a.fat_g + m.fat_g }),
    ZERO,
  )
}

/** Carbs fill whatever calories protein (4 kcal/g) and fat (9 kcal/g) leave. Never negative. */
export function carbsFromRemainder(kcal: number, proteinG: number, fatG: number): number {
  return Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))
}

/** Safety guardrail (CLAUDE.md). The owner is male; sex-specific floors arrive with the Phase 5 profile. */
export const CALORIE_FLOOR = 1500
export const FAT_FLOOR_G = 40

/** Problems with a target, in plain words. Empty = OK. */
export function targetProblems(t: { kcal: number; protein_g: number; fat_g: number }): string[] {
  const out: string[] = []
  if (t.kcal < CALORIE_FLOOR) out.push(`Calories can't go below ${CALORIE_FLOOR} kcal (safety floor).`)
  if (t.kcal > 6000) out.push('Calories look too high (max 6,000).')
  if (t.fat_g < FAT_FLOOR_G) out.push(`Keep fat at ${FAT_FLOOR_G} g or more for hormone health.`)
  if (t.protein_g * 4 + t.fat_g * 9 > t.kcal) out.push('Protein and fat alone are more than your calories.')
  return out
}

/** Default starting target (CLAUDE.md owner profile): ~2,700 kcal recomp, 200 g protein, 65 g fat, carbs = rest. */
export function defaultTarget(): Macros {
  const kcal = 2700
  const protein_g = 200
  const fat_g = 65
  return { kcal, protein_g, fat_g, carbs_g: carbsFromRemainder(kcal, protein_g, fat_g) }
}

/** The target in effect on `date`: the latest one that started on or before it. */
export function targetOn<T extends { effective_from: string; deleted_at: string | null }>(targets: T[], date: string): T | null {
  return (
    targets
      .filter((t) => !t.deleted_at && t.effective_from <= date)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null
  )
}

/** Shift a local YYYY-MM-DD date by `days`. */
export function addDaysKey(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const r = new Date(y, m - 1, d + days)
  return `${r.getFullYear()}-${String(r.getMonth() + 1).padStart(2, '0')}-${String(r.getDate()).padStart(2, '0')}`
}

export const round0 = (n: number) => Math.round(n)
