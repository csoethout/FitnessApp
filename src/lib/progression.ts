// Double progression (CLAUDE.md → Progression). Pure and unit tested; used to pre-fill today's sets and to explain
// the suggestion in the logger. Nothing here is stored: the suggestion is recomputed from your history.
import type { SetType } from '@/data/types'
import { kgToLb, toStoredKg, type WeightUnit } from './units'

export type HistorySet = { weight_kg: number; reps: number; set_type: SetType; completed_at: string | null; position: number }
export type PlannedSet = { weight_kg: number; reps: number }
export type SuggestionKind = 'first' | 'increase' | 'reps' | 'deload' | 'bodyweight'
export type Suggestion = { kind: SuggestionKind; sets: PlannedSet[]; reason: string }

export type ProgressionInput = {
  sessions: HistorySet[][] // this exercise's past sessions, most recent first
  sets: number // how many working sets to plan
  repMin: number
  repMax: number
  bigJump: boolean // barbell lower body: +10 lb (or +5 kg) instead of +5 lb (+2.5 kg)
  unit: WeightUnit
}

/** Muscles that make a barbell lift "lower body" for the bigger jump (squat, deadlift, RDL, hip thrust…). */
const LOWER_BODY = new Set(['quadriceps', 'hamstrings', 'glutes', 'lower back', 'adductors', 'abductors', 'calves'])

export function isBigJump(ex: { equipment: string | null; primary_muscles: string[] } | undefined): boolean {
  return !!ex && ex.equipment === 'barbell' && (ex.primary_muscles ?? []).some((m) => LOWER_BODY.has(m))
}

/** Completed working sets only: warm-ups and "couldn't finish" (limited) sets don't count for progression. */
const working = (s: HistorySet[]) => s.filter((x) => x.completed_at && x.set_type === 'working').sort((a, b) => a.position - b.position)

/** Work in the display unit so jumps land on real plates (185 → 190 lb, not 185 → 189.9). */
function step(unit: WeightUnit, big: boolean) {
  return unit === 'lb' ? (big ? 10 : 5) : big ? 5 : 2.5
}
const toUnit = (kg: number, unit: WeightUnit) => (unit === 'lb' ? Math.round(kgToLb(kg) * 2) / 2 : Math.round(kg * 4) / 4)
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

export function suggestNext(input: ProgressionInput): Suggestion {
  const { sets, repMin, repMax, unit } = input
  const history = input.sessions.map(working).filter((s) => s.length > 0)
  const last = history[0]
  if (!last) {
    return { kind: 'first', sets: Array.from({ length: sets }, () => ({ weight_kg: 0, reps: repMin })), reason: `First time: pick a weight you could lift about ${repMin + 2} times.` }
  }
  const pick = <T,>(arr: T[], i: number) => arr[i] ?? arr[arr.length - 1]
  const top = Math.max(...last.map((s) => s.weight_kg))

  // Bodyweight (no weight logged): just add a rep each time.
  if (top === 0) {
    return {
      kind: 'bodyweight',
      sets: Array.from({ length: sets }, (_, i) => ({ weight_kg: 0, reps: pick(last, i).reps + 1 })),
      reason: '+1 rep per set (bodyweight).',
    }
  }

  const u = unit
  const topU = toUnit(top, u)
  const jump = step(u, input.bigJump)

  // All working sets reached the top of the range → add weight, back to the bottom of the range.
  if (last.every((s) => s.reps >= repMax)) {
    const w = toStoredKg(topU + jump, u)
    return {
      kind: 'increase',
      sets: Array.from({ length: sets }, () => ({ weight_kg: w, reps: repMin })),
      reason: `+${jump} ${u}: every set hit ${repMax} last time.`,
    }
  }

  // Missed the bottom of the range two sessions in a row → take 10% off and rebuild.
  const missed = (s: HistorySet[]) => s.some((x) => x.reps < repMin)
  if (history.length >= 2 && missed(history[0]) && missed(history[1])) {
    const roundTo = u === 'lb' ? 5 : 2.5
    const w = Math.max(roundTo, Math.round((topU * 0.9) / roundTo) * roundTo)
    return {
      kind: 'deload',
      sets: Array.from({ length: sets }, () => ({ weight_kg: toStoredKg(w, u), reps: repMin })),
      reason: `−10% to ${fmt(w)} ${u}: under ${repMin} reps twice in a row.`,
    }
  }

  // Otherwise: same weights, one more rep per set (within the range).
  return {
    kind: 'reps',
    sets: Array.from({ length: sets }, (_, i) => {
      const s = pick(last, i)
      return { weight_kg: s.weight_kg, reps: Math.min(repMax, Math.max(repMin, s.reps + 1)) }
    }),
    reason: `Same weight, +1 rep per set (weight goes up at ${repMax}).`,
  }
}
