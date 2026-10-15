import { kgToLb, lbToKg } from './units'

export type WarmupSet = { weight_kg: number; reps: number }

/** Empty-bar weights in lb. Other equipment starts at a percentage instead. */
const BAR_LB: Record<string, number> = { barbell: 45, 'e-z curl bar': 25 }

/** Working weights at or above this get a second, heavier warm-up set. */
const TWO_SETS_FROM_LB = 135

/**
 * Warm-up before the first compound lift (owner's preference: keep it short, 1–2 sets):
 * 50% × 8, plus 75% × 3 when the working weight is 135 lb or more.
 * Barbell lifts never go below the empty bar. Weights round to 5 lb; a step that isn't at least
 * 10 lb above the previous one, or that reaches the working weight, is dropped.
 * Returns [] when there's no working weight yet.
 */
export function warmupPlan(workingKg: number, equipment: string | null): WarmupSet[] {
  const work = Math.round(kgToLb(workingKg) * 10) / 10 // 45 lb stored in kg reads back as 45.00001
  if (work <= 0) return []
  const bar = equipment ? BAR_LB[equipment] : undefined
  const round5 = (lb: number) => Math.round(lb / 5) * 5
  const steps: [number, number][] = [[Math.max(bar ?? 0, round5(work * 0.5)), 8]]
  if (work >= TWO_SETS_FROM_LB) steps.push([round5(work * 0.75), 3])
  const out: WarmupSet[] = []
  let last = 0
  for (const [lb, reps] of steps) {
    if (lb < 5 || (last && lb - last < 10) || lb >= work) continue
    out.push({ weight_kg: Math.round(lbToKg(lb) * 10_000) / 10_000, reps })
    last = lb
  }
  return out
}
