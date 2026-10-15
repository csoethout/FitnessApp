import type { Exercise } from '@/data/types'
import { DISCOURAGED_NAME, STAPLE_SOURCE_IDS } from './staples'

export type AlternativeOptions = {
  equipment: string[] | null // available equipment at the current gym (null = anything)
  unavailableIds: Set<string> // marked "Not at this gym"
  excludeIds: Set<string> // e.g. exercises already in the workout
}

/**
 * Substitutes for an exercise, best first. Must share a primary muscle and be doable at the gym.
 * Score: everyday staples first, then same primary muscles, same movement type (compound/isolation),
 * same push/pull, same equipment, shared secondary muscles. Expert, olympic and risky variations sink.
 */
export function rankAlternatives(target: Exercise, all: Exercise[], opts: AlternativeOptions): Exercise[] {
  const primary = new Set(target.primary_muscles)
  const secondary = new Set(target.secondary_muscles)
  return all
    .filter((e) => e.id !== target.id && !e.deleted_at)
    .filter((e) => !opts.excludeIds.has(e.id) && !opts.unavailableIds.has(e.id))
    .filter((e) => !opts.equipment || e.equipment === null || opts.equipment.includes(e.equipment))
    .filter((e) => e.category !== 'stretching' && e.primary_muscles.some((m) => primary.has(m)))
    .map((e) => ({ e, score: score(target, e, primary, secondary) }))
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
    .map((x) => x.e)
}

function score(target: Exercise, e: Exercise, primary: Set<string>, secondary: Set<string>): number {
  let s = 0
  if (e.source_id && STAPLE_SOURCE_IDS.has(e.source_id)) s += 5
  if (DISCOURAGED_NAME.test(e.name)) s -= 6
  if (target.equipment && e.equipment === target.equipment) s += 1
  s += Math.min(2, sharedNameWords(target.name, e.name)) * 1.5 // "Lateral Raise" ~ "Cable Seated Lateral Raise"
  const samePrimary = e.primary_muscles.length === primary.size && e.primary_muscles.every((m) => primary.has(m))
  if (samePrimary) s += 4
  if (target.mechanic && e.mechanic === target.mechanic) s += 3
  if (target.force && e.force === target.force) s += 2
  s += e.secondary_muscles.filter((m) => secondary.has(m)).length * 0.5
  if (e.level === 'expert' || e.category === 'olympic weightlifting' || e.category === 'strongman') s -= 5
  if (e.category === 'plyometrics' || e.category === 'cardio') s -= 3
  return s
}

// Words that describe equipment or grip rather than the movement, ignored when comparing names.
const NOISE = new Set(['barbell', 'dumbbell', 'dumbbells', 'cable', 'machine', 'smith', 'leverage', 'with', 'the', 'a', 'to',
  'on', 'and', 'of', 'one', 'arm', 'two', 'seated', 'standing', 'medium', 'grip', 'close', 'wide', 'alternating', 'alternate',
  'version', 'attachment', 'ez', 'bar', 'lying'])

function words(name: string): Set<string> {
  return new Set(name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !NOISE.has(w)).map((w) => w.replace(/s$/, '')))
}

function sharedNameWords(a: string, b: string): number {
  const wa = words(a)
  return [...words(b)].filter((w) => wa.has(w)).length
}

/** All equipment types in the library, for the gym editor. */
export const ALL_EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'machine', 'body only', 'e-z curl bar', 'kettlebells', 'bands',
  'medicine ball', 'exercise ball', 'foam roll', 'other',
]
