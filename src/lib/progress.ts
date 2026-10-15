import { MUSCLE_GROUPS } from './training'
import { bestE1rm, countedSets, findPRs, heaviest, volumeKg, type StatSet } from './stats'

/** One exercise as done in one workout. */
export type ExerciseSession = {
  exerciseId: string
  workoutId: string
  startedAt: string // ISO
  primaryMuscles: string[]
  sets: StatSet[] // completed sets only
}

const DAY = 86_400_000

/** Local-time start of the week containing `date` (weeks start Sunday by default). */
export function startOfWeek(date: Date, weekStartDay = 0): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() - weekStartDay + 7) % 7))
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/**
 * Working sets per muscle group in [weekStart, weekStart + 7 days).
 * A set counts once for each group its exercise's PRIMARY muscles belong to; warm-ups don't count.
 * (Bench press → Chest only, not Arms.)
 */
export function weeklyMuscleSets(sessions: ExerciseSession[], weekStart: Date): { label: string; sets: number }[] {
  const end = addDays(weekStart, 7)
  const counts = new Map(MUSCLE_GROUPS.map((g) => [g.label, 0]))
  for (const s of sessions) {
    const t = new Date(s.startedAt)
    if (t < weekStart || t >= end) continue
    const n = s.sets.filter((x) => x.completed_at && x.set_type !== 'warmup').length
    const groups = new Set(MUSCLE_GROUPS.filter((g) => g.muscles.some((m) => s.primaryMuscles.includes(m))).map((g) => g.label))
    for (const g of groups) counts.set(g, (counts.get(g) ?? 0) + n)
  }
  return MUSCLE_GROUPS.map((g) => ({ label: g.label, sets: counts.get(g.label) ?? 0 }))
}

/** Total volume per week for the last `weeks` weeks, oldest first, ending with the current week. */
export function weeklyVolume(sessions: ExerciseSession[], now: Date, weeks = 8): { weekStart: Date; volumeKg: number }[] {
  const current = startOfWeek(now)
  const buckets = Array.from({ length: weeks }, (_, i) => ({ weekStart: addDays(current, -7 * (weeks - 1 - i)), volumeKg: 0 }))
  for (const s of sessions) {
    const t = new Date(s.startedAt)
    const b = buckets.find((x) => t >= x.weekStart && t < addDays(x.weekStart, 7))
    if (b) b.volumeKg += volumeKg(s.sets)
  }
  return buckets
}

export type Metric = 'e1rm' | 'weight' | 'reps'
export type Point = { date: string; e1rm: number | null; weight: number | null; reps: number | null }

/** One point per session for an exercise, oldest first. */
export function sessionPoints(sessions: ExerciseSession[]): Point[] {
  return [...sessions]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((s) => {
      const counted = countedSets(s.sets)
      return {
        date: s.startedAt,
        e1rm: bestE1rm(s.sets),
        weight: heaviest(s.sets) || null,
        reps: counted.length ? Math.max(...counted.map((x) => x.reps)) : null,
      }
    })
    .filter((p) => p.e1rm !== null || p.weight !== null || p.reps !== null)
}

/**
 * Which number to track for an exercise: estimated 1-rep max when there are sets of ≤10 reps,
 * otherwise the heaviest weight (e.g. curls for 12–15), otherwise most reps (bodyweight moves).
 */
export function chooseMetric(points: Point[]): Metric {
  if (points.some((p) => p.e1rm !== null)) return 'e1rm'
  if (points.some((p) => p.weight !== null)) return 'weight'
  return 'reps'
}

/**
 * Change in `metric` over roughly the last `days` days: latest session vs the last session on or before
 * (now − days); if there's none that old, vs the first session. null with fewer than two sessions.
 */
export function recentChange(points: Point[], metric: Metric, now: Date, days = 28): { delta: number; since: 'period' | 'start' } | null {
  const valued = points.filter((p) => p[metric] !== null)
  if (valued.length < 2) return null
  const latest = valued[valued.length - 1]
  const cutoff = now.getTime() - days * DAY
  const older = valued.filter((p) => Date.parse(p.date) <= cutoff)
  const base = older.length ? older[older.length - 1] : valued[0]
  if (base === latest) return null
  return { delta: (latest[metric] as number) - (base[metric] as number), since: older.length ? 'period' : 'start' }
}

export type PrEvent = { exerciseId: string; date: string; kind: 'e1rm' | 'weight'; value: number; previous: number }

/** Every PR in history: each session compared with all earlier sessions of the same exercise. */
export function prEvents(sessions: ExerciseSession[]): PrEvent[] {
  const byExercise = new Map<string, ExerciseSession[]>()
  for (const s of sessions) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s])
  const events: PrEvent[] = []
  for (const [exerciseId, list] of byExercise) {
    const sorted = [...list].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    let earlier: StatSet[] = []
    for (const s of sorted) {
      for (const pr of findPRs(s.sets, earlier)) events.push({ exerciseId, date: s.startedAt, ...pr })
      earlier = earlier.concat(s.sets)
    }
  }
  return events.sort((a, b) => b.date.localeCompare(a.date))
}
