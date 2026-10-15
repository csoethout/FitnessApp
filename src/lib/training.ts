import type { Exercise } from '@/data/types'

/** Rest defaults (CLAUDE.md): 3 min main lifts, 2 min other compounds, 1 min isolation. */
export function defaultRestSeconds(isMainLift: boolean, mechanic: Exercise['mechanic']): number {
  if (isMainLift) return 180
  return mechanic === 'isolation' ? 60 : 120
}

/** Rep range defaults (CLAUDE.md): compounds 6–10, isolation 10–15. */
export function defaultRepRange(mechanic: Exercise['mechanic']): [number, number] {
  return mechanic === 'isolation' ? [10, 15] : [6, 10]
}

/** Friendly muscle groups used for filter chips. Values are free-exercise-db muscle names. */
export const MUSCLE_GROUPS: { label: string; muscles: string[] }[] = [
  { label: 'Chest', muscles: ['chest'] },
  { label: 'Back', muscles: ['lats', 'middle back', 'lower back', 'traps'] },
  { label: 'Shoulders', muscles: ['shoulders'] },
  { label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { label: 'Legs', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors'] },
  { label: 'Core', muscles: ['abdominals'] },
]

/** Equipment a typical commercial gym has; used for the starter "Main gym" profile. */
export const MAIN_GYM_EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'e-z curl bar', 'other']

export type ExerciseFilter = {
  query?: string
  muscles?: string[] | null // any of these as a primary muscle
  equipment?: string[] | null // only exercises using this equipment (or none)
  excludeIds?: Set<string>
}

/** Search the library: every word in the query must appear in the name. */
export function filterExercises(all: Exercise[], f: ExerciseFilter): Exercise[] {
  const words = (f.query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  return all
    .filter((e) => !e.deleted_at)
    .filter((e) => !f.excludeIds?.has(e.id))
    .filter((e) => {
      const name = e.name.toLowerCase()
      return words.every((w) => name.includes(w))
    })
    .filter((e) => !f.muscles || e.primary_muscles.some((m) => f.muscles!.includes(m)))
    .filter((e) => !f.equipment || e.equipment === null || f.equipment.includes(e.equipment))
    .sort((a, b) => levelRank(a) - levelRank(b) || a.name.localeCompare(b.name))
}

// Show everyday exercises before expert/olympic ones.
function levelRank(e: Exercise) {
  return e.level === 'expert' || e.category === 'olympic weightlifting' || e.category === 'strongman' ? 1 : 0
}

/** Rest after a set: warm-ups are short; otherwise the exercise's own rest. */
export function restAfterSet(setType: 'warmup' | 'working' | 'limited', exerciseRestSeconds: number): number {
  return setType === 'warmup' ? 60 : exerciseRestSeconds
}
