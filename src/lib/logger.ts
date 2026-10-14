import type { SetType } from '@/data/types'
import { displayWeight, type WeightUnit } from './units'

export type SetLike = { weight_kg: number; reps: number; set_type: SetType; completed_at: string | null; position: number }
export type PlannedSet = { weight_kg: number; reps: number }

/**
 * Phase 2 pre-fill: repeat what you did last time, set by set (warm-ups ignored).
 * Extra sets copy the last one. With no history: empty bar weight 0 and the bottom of the rep range.
 * (Automatic weight increases arrive with the Phase 5 planner.)
 */
export function prefillSets(count: number, lastSets: SetLike[], repMin: number): PlannedSet[] {
  const done = lastSets
    .filter((s) => s.completed_at && s.set_type !== 'warmup')
    .sort((a, b) => a.position - b.position)
  return Array.from({ length: count }, (_, i) => {
    const src = done[i] ?? done[done.length - 1]
    return src ? { weight_kg: src.weight_kg, reps: src.reps } : { weight_kg: 0, reps: repMin }
  })
}

/** "185×8 · 185×8 · 185×7" — completed sets from last time, warm-ups left out. */
export function formatLastTime(lastSets: SetLike[], unit: WeightUnit): string | null {
  const done = lastSets
    .filter((s) => s.completed_at && s.set_type !== 'warmup')
    .sort((a, b) => a.position - b.position)
  if (!done.length) return null
  return done.map((s) => `${formatWeight(s.weight_kg, unit)}×${s.reps}`).join(' · ')
}

/** Weight for display: whole numbers without decimals ("185"), otherwise one decimal ("102.5"). */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const v = displayWeight(kg, unit, unit === 'lb' ? 0.5 : 0.25)
  return Number.isInteger(v) ? String(v) : v.toFixed(unit === 'lb' ? 1 : 2).replace(/0$/, '')
}

/** Index of the set you're on: the first one not yet completed. -1 when everything is done. */
export function currentSetIndex(sets: SetLike[]): number {
  return [...sets].sort((a, b) => a.position - b.position).findIndex((s) => !s.completed_at)
}

/** Elapsed time as m:ss or h:mm:ss. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/**
 * When you change the set you're on, later not-yet-done sets that still had the same value follow along
 * (change set 1 from 0 to 135 lb and sets 2–3 become 135 too). Sets you already adjusted are left alone.
 */
export function cascadeIds<T extends SetLike & { id: string }>(
  sets: T[],
  changedId: string,
  field: 'weight_kg' | 'reps',
  oldValue: number,
): string[] {
  const sorted = [...sets].sort((a, b) => a.position - b.position)
  const from = sorted.findIndex((s) => s.id === changedId)
  if (from < 0) return []
  return sorted
    .slice(from + 1)
    .filter((s) => !s.completed_at && s.set_type !== 'warmup' && s[field] === oldValue)
    .map((s) => s.id)
}
