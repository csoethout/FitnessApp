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

/** Optional label lines, in display order. Units: g except cholesterol and sodium (mg). */
export const EXTRA_NUTRIENTS = [
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sat_fat', label: 'Sat. fat', unit: 'g' },
  { key: 'trans_fat', label: 'Trans fat', unit: 'g' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
] as const
export type ExtraKey = (typeof EXTRA_NUTRIENTS)[number]['key']
export type Extras = Partial<Record<ExtraKey, number | null>>

/** Column name for an extra nutrient on foods ("fiber_g") and on log entries ("fiber_g_per_serving"). */
export const foodCol = (k: ExtraKey) => (k === 'cholesterol' || k === 'sodium' ? `${k}_mg` : `${k}_g`) as `${ExtraKey}_${'g' | 'mg'}`
export const entryCol = (k: ExtraKey) => `${foodCol(k)}_per_serving`

/** Day totals of the optional nutrients; only those that appear in at least one entry. */
export function sumExtras(entries: (Record<string, unknown> & { servings: number })[]): { key: ExtraKey; label: string; unit: string; total: number }[] {
  return EXTRA_NUTRIENTS.flatMap((n) => {
    const vals = entries.map((e) => e[entryCol(n.key)] as number | null | undefined).filter((v): v is number => typeof v === 'number')
    if (!vals.length) return []
    const total = entries.reduce((s, e) => s + (((e[entryCol(n.key)] as number | null | undefined) ?? 0) * e.servings), 0)
    return [{ key: n.key, label: n.label, unit: n.unit, total }]
  })
}

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

/** Calories implied by macros: 4 kcal/g protein and carbs, 9 kcal/g fat. */
export function macroKcal(protein_g: number, carbs_g: number, fat_g: number): number {
  return protein_g * 4 + carbs_g * 4 + fat_g * 9
}

export type MacroCheck = { implied: number; status: 'ok' | 'over' | 'under'; message: string | null }

/**
 * Do the macros fit the calories? Labels round, and fiber counts as carbs but has fewer calories,
 * so allow ~15% (+10 kcal) over. More than that can't be right → 'over' (blocks saving).
 * Much less than the calories (e.g. alcohol, a missing number) → 'under' (a hint only).
 */
export function checkMacros(kcal: number, protein_g: number, carbs_g: number, fat_g: number): MacroCheck {
  const implied = macroKcal(protein_g, carbs_g, fat_g)
  if (implied > kcal * 1.15 + 10) {
    return {
      implied,
      status: 'over',
      message: `Protein, carbs and fat add up to ${Math.round(implied)} kcal, more than the ${Math.round(kcal)} kcal entered. Check the label.`,
    }
  }
  if (implied > 0 && implied < kcal * 0.6 - 10) {
    return { implied, status: 'under', message: `Protein, carbs and fat only account for ${Math.round(implied)} of ${Math.round(kcal)} kcal. Missing a number?` }
  }
  return { implied, status: 'ok', message: null }
}
