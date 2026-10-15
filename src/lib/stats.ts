import type { SetType } from '@/data/types'

export type StatSet = { weight_kg: number; reps: number; set_type: SetType; completed_at: string | null }

/** Sets that count for strength stats: done, not warm-ups, not "couldn't finish". */
export function countedSets<T extends StatSet>(sets: T[]): T[] {
  return sets.filter((s) => s.completed_at && s.set_type === 'working' && s.reps > 0)
}

/**
 * Estimated one-rep max (Epley): weight × (1 + reps / 30). Only trusted up to 10 reps (CLAUDE.md);
 * a single rep is the weight itself. Returns null when the set can't be used.
 */
export function e1rm(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > 10 || weightKg <= 0) return null
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

export function bestE1rm(sets: StatSet[]): number | null {
  const values = countedSets(sets)
    .map((s) => e1rm(s.weight_kg, s.reps))
    .filter((v): v is number => v !== null)
  return values.length ? Math.max(...values) : null
}

export function heaviest(sets: StatSet[]): number | null {
  const w = countedSets(sets).map((s) => s.weight_kg)
  return w.length ? Math.max(...w) : null
}

/** Total weight moved (weight × reps) for done, non-warm-up sets. "Couldn't finish" sets still count here. */
export function volumeKg(sets: StatSet[]): number {
  return sets
    .filter((s) => s.completed_at && s.set_type !== 'warmup')
    .reduce((sum, s) => sum + s.weight_kg * s.reps, 0)
}

export function workingSetCount(sets: StatSet[]): number {
  return sets.filter((s) => s.completed_at && s.set_type !== 'warmup').length
}

export type PR = { kind: 'e1rm' | 'weight'; value: number; previous: number }

/**
 * Personal records in this session compared with everything before it. No PRs the first time you do an
 * exercise (there's nothing to beat yet). Tiny rounding differences don't count.
 */
export function findPRs(current: StatSet[], previous: StatSet[]): PR[] {
  const prs: PR[] = []
  const prevE1 = bestE1rm(previous)
  const curE1 = bestE1rm(current)
  if (prevE1 !== null && curE1 !== null && curE1 > prevE1 + 0.01) prs.push({ kind: 'e1rm', value: curE1, previous: prevE1 })
  const prevW = heaviest(previous)
  const curW = heaviest(current)
  if (prevW !== null && curW !== null && curW > prevW + 0.01) prs.push({ kind: 'weight', value: curW, previous: prevW })
  return prs
}
