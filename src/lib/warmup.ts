import { kgToLb, lbToKg } from './units'

export type WarmupSet = { weight_kg: number; reps: number }

/** Empty-bar weights in lb. Other equipment starts at a percentage instead. */
const BAR_LB: Record<string, number> = { barbell: 45, 'e-z curl bar': 25 }

/**
 * Ramp-up sets before the first heavy compound lift (CLAUDE.md): bar×10, 50%×5, 70%×3, 85%×1.
 * Without a bar the first set is 40%×10. Weights round to 5 lb; steps that are too light, less than
 * 10 lb above the previous step, or at the working weight are dropped. Returns [] when there's no working weight yet.
 */
export function warmupPlan(workingKg: number, equipment: string | null): WarmupSet[] {
  const work = kgToLb(workingKg)
  if (work <= 0) return []
  const bar = equipment ? BAR_LB[equipment] : undefined
  const round5 = (lb: number) => Math.round(lb / 5) * 5
  const steps: [number, number][] = [
    [bar ?? round5(work * 0.4), 10],
    [round5(work * 0.5), 5],
    [round5(work * 0.7), 3],
    [round5(work * 0.85), 1],
  ]
  const out: WarmupSet[] = []
  let last = 0
  for (const [lb, reps] of steps) {
    // Skip a step that's too light, under 10 lb above the previous one, or at the working weight.
    if (lb < (bar ?? 5) || (last && lb - last < 10) || lb >= work) continue
    out.push({ weight_kg: Math.round(lbToKg(lb) * 10_000) / 10_000, reps })
    last = lb
  }
  return out
}
