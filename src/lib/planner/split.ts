// Rules-based weekly split for new users (setup wizard). Pure: answers + exercise library in, starter days out.
// The result goes through applyStarterSplit (or replaces the active week), after which the rows are the user's own.
import type { StarterDay, StarterExercise } from '@/lib/starterSplit'

export type Experience = 'new' | 'returning' | 'experienced'
/** Body areas (same names as the muscle groups on Progress). */
export const AREAS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] as const
export type Area = (typeof AREAS)[number]
export type AreaChoice = 'skip' | 'normal' | 'focus'
/** Missing = normal. */
export type Focus = Partial<Record<Area, AreaChoice>>

export type SplitAnswers = {
  days: number[] // training days of the week, 0 = Sunday
  minutes: number // per session
  experience: Experience
  equipment: string[] // the usual gym's equipment ('body only' etc.)
  focus?: Focus // areas to skip or focus on
}

/** Exercise library lookup: source id → its equipment (null = none needed). Missing = not in the library. */
export type EquipmentOf = Map<string, string | null>

type Slot = { candidates: string[]; compound: boolean; main?: boolean; area: Area }

// Movement slots: best choice first, falling back to what the gym has. Data, not logic: extend freely.
// Every id is checked against the exercise library by a test.
const S = {
  squat: ['Barbell_Squat', 'Hack_Squat', 'Leg_Press', 'Dumbbell_Squat', 'Bodyweight_Squat'],
  legPress: ['Leg_Press', 'Hack_Squat', 'Smith_Machine_Squat', 'Dumbbell_Squat', 'Bodyweight_Squat'],
  hinge: ['Romanian_Deadlift', 'Stiff-Legged_Dumbbell_Deadlift', 'Single_Leg_Glute_Bridge'],
  lunge: ['Dumbbell_Lunges', 'Split_Squat_with_Dumbbells', 'Barbell_Lunge', 'Bodyweight_Walking_Lunge'],
  hipThrust: ['Barbell_Hip_Thrust', 'Barbell_Glute_Bridge', 'Single_Leg_Glute_Bridge', 'Butt_Lift_Bridge'],
  quadIso: ['Leg_Extensions', 'Split_Squat_with_Dumbbells', 'Bodyweight_Walking_Lunge'],
  legCurl: ['Lying_Leg_Curls', 'Seated_Leg_Curl', 'Standing_Leg_Curl', 'Stiff-Legged_Dumbbell_Deadlift', 'Single_Leg_Glute_Bridge'],
  calf: ['Standing_Calf_Raises', 'Seated_Calf_Raise', 'Standing_Dumbbell_Calf_Raise'],
  bench: ['Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Bench_Press', 'Machine_Bench_Press', 'Pushups'],
  dbBench: ['Dumbbell_Bench_Press', 'Machine_Bench_Press', 'Barbell_Bench_Press_-_Medium_Grip', 'Pushups'],
  incline: ['Incline_Dumbbell_Press', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Leverage_Incline_Chest_Press', 'Decline_Push-Up'],
  ohp: ['Dumbbell_Shoulder_Press', 'Machine_Shoulder_Military_Press', 'Barbell_Shoulder_Press', 'Decline_Push-Up'],
  fly: ['Cable_Crossover', 'Butterfly', 'Dumbbell_Flyes', 'Push-Up_Wide'],
  lateral: ['Side_Lateral_Raise', 'Cable_Seated_Lateral_Raise'],
  rearDelt: ['Face_Pull', 'Reverse_Machine_Flyes', 'Seated_Bent-Over_Rear_Delt_Raise'],
  pulldown: ['Wide-Grip_Lat_Pulldown', 'Close-Grip_Front_Lat_Pulldown', 'Bent_Over_Two-Dumbbell_Row', 'Pullups', 'Inverted_Row'],
  row: ['Bent_Over_Barbell_Row', 'Seated_Cable_Rows', 'One-Arm_Dumbbell_Row', 'Inverted_Row'],
  row2: ['Seated_Cable_Rows', 'One-Arm_Dumbbell_Row', 'T-Bar_Row_with_Handle', 'Inverted_Row'],
  curl: ['Barbell_Curl', 'Dumbbell_Bicep_Curl', 'EZ-Bar_Curl'],
  hammer: ['Hammer_Curls', 'Dumbbell_Bicep_Curl', 'Cable_Hammer_Curls_-_Rope_Attachment'],
  triceps: ['Triceps_Pushdown_-_Rope_Attachment', 'Triceps_Pushdown', 'Standing_Dumbbell_Triceps_Extension', 'Bench_Dips'],
  triceps2: ['EZ-Bar_Skullcrusher', 'Cable_Rope_Overhead_Triceps_Extension', 'Standing_Dumbbell_Triceps_Extension', 'Bench_Dips'],
  core: ['Cable_Crunch', 'Hanging_Leg_Raise', 'Plank', 'Reverse_Crunch'],
}

/** Which body area each movement trains (its primary muscles). */
const AREA_OF: Record<keyof typeof S, Area> = {
  squat: 'Legs', legPress: 'Legs', hinge: 'Legs', lunge: 'Legs', hipThrust: 'Legs', quadIso: 'Legs', legCurl: 'Legs', calf: 'Legs',
  bench: 'Chest', dbBench: 'Chest', incline: 'Chest', fly: 'Chest',
  ohp: 'Shoulders', lateral: 'Shoulders', rearDelt: 'Shoulders',
  pulldown: 'Back', row: 'Back', row2: 'Back',
  curl: 'Arms', hammer: 'Arms', triceps: 'Arms', triceps2: 'Arms',
  core: 'Core',
}
const areaOf = (c: string[]) => AREA_OF[(Object.keys(S) as (keyof typeof S)[]).find((k) => S[k] === c)!]
const main = (c: string[]): Slot => ({ candidates: c, compound: true, main: true, area: areaOf(c) })
const comp = (c: string[]): Slot => ({ candidates: c, compound: true, area: areaOf(c) })
const iso = (c: string[]): Slot => ({ candidates: c, compound: false, area: areaOf(c) })

/** Extra exercises per area, used to fill a day when skipped areas leave room, and to add focus work. */
const EXTRA: Record<Area, Slot[]> = {
  Chest: [comp(S.incline), iso(S.fly), comp(S.dbBench)],
  Back: [comp(S.row2), comp(S.pulldown), comp(S.row)],
  Shoulders: [iso(S.lateral), iso(S.rearDelt), comp(S.ohp)],
  Arms: [iso(S.curl), iso(S.triceps), iso(S.hammer), iso(S.triceps2)],
  Legs: [iso(S.legCurl), iso(S.quadIso), iso(S.calf), comp(S.lunge)],
  Core: [iso(S.core)],
}

/** Sessions: slots in order of importance; shorter sessions drop from the end. */
const SESSIONS: Record<string, { name: string; priority: number; slots: Slot[] }> = {
  fullA: { name: 'Full Body A', priority: 5, slots: [main(S.squat), main(S.bench), comp(S.row), comp(S.hinge), iso(S.lateral), iso(S.core), iso(S.curl)] },
  fullB: { name: 'Full Body B', priority: 4, slots: [main(S.hinge), main(S.ohp), comp(S.pulldown), comp(S.lunge), iso(S.triceps), iso(S.core), iso(S.calf)] },
  fullC: { name: 'Full Body C', priority: 3, slots: [main(S.legPress), main(S.incline), comp(S.row2), iso(S.legCurl), iso(S.lateral), iso(S.hammer), iso(S.triceps)] },
  upperA: { name: 'Upper A', priority: 5, slots: [main(S.bench), main(S.row), comp(S.ohp), comp(S.pulldown), iso(S.lateral), iso(S.triceps), iso(S.curl)] },
  upperB: { name: 'Upper B', priority: 3, slots: [main(S.incline), main(S.pulldown), comp(S.row2), iso(S.fly), iso(S.rearDelt), iso(S.hammer), iso(S.triceps2)] },
  lowerA: { name: 'Lower A', priority: 5, slots: [main(S.squat), comp(S.hinge), comp(S.lunge), iso(S.legCurl), iso(S.calf), iso(S.core), iso(S.quadIso)] },
  lowerB: { name: 'Lower B', priority: 4, slots: [main(S.hinge), comp(S.legPress), comp(S.hipThrust), iso(S.quadIso), iso(S.calf), iso(S.core), iso(S.legCurl)] },
  push: { name: 'Push', priority: 4, slots: [main(S.bench), comp(S.ohp), comp(S.incline), iso(S.lateral), iso(S.triceps), iso(S.fly), iso(S.triceps2)] },
  pull: { name: 'Pull', priority: 3, slots: [main(S.row), comp(S.pulldown), comp(S.row2), iso(S.rearDelt), iso(S.curl), iso(S.hammer), iso(S.core)] },
  legs: { name: 'Legs', priority: 5, slots: [main(S.squat), comp(S.hinge), comp(S.legPress), iso(S.legCurl), iso(S.calf), iso(S.core), iso(S.quadIso)] },
  pushB: { name: 'Push B', priority: 2, slots: [main(S.ohp), comp(S.incline), comp(S.dbBench), iso(S.lateral), iso(S.triceps2), iso(S.fly), iso(S.triceps)] },
  pullB: { name: 'Pull B', priority: 2, slots: [main(S.pulldown), comp(S.row2), comp(S.row), iso(S.rearDelt), iso(S.hammer), iso(S.core), iso(S.curl)] },
  legsB: { name: 'Legs B', priority: 3, slots: [main(S.hinge), comp(S.legPress), comp(S.lunge), iso(S.hipThrust), iso(S.calf), iso(S.core), iso(S.legCurl)] },
}

/** Which sessions for how many training days (more days = each session trains less of the body). */
export function sessionKeys(count: number, experience: Experience, focus: Focus = {}): string[] {
  const n = Math.min(Math.max(count, 1), 6)
  const skip = (a: Area) => focus[a] === 'skip'
  // No legs: every day is an upper-body day. Only legs (and core): every day is a leg day.
  if (skip('Legs')) return UPPER_ORDER[n]
  if ((['Chest', 'Back', 'Shoulders', 'Arms'] as Area[]).every(skip)) return Array.from({ length: n }, (_, i) => ['lowerA', 'lowerB', 'legs'][i % 3])
  switch (n) {
    case 1: return ['fullA']
    case 2: return ['fullA', 'fullB']
    case 3: return experience === 'new' ? ['fullA', 'fullB', 'fullC'] : ['push', 'pull', 'legs']
    case 4: return ['upperA', 'lowerA', 'upperB', 'lowerB']
    case 5: return ['upperA', 'lowerA', 'push', 'pull', 'legs']
    default: return ['push', 'pull', 'legs', 'pushB', 'pullB', 'legsB']
  }
}

// Upper-body weeks: 2 days = Upper A/B; 3 = push, pull, upper; more = add the B days.
const UPPER_ORDER: Record<number, string[]> = {
  1: ['upperA'],
  2: ['upperA', 'upperB'],
  3: ['push', 'pull', 'upperA'],
  4: ['push', 'pull', 'upperA', 'upperB'],
  5: ['push', 'pull', 'upperA', 'pushB', 'pullB'],
  6: ['push', 'pull', 'upperA', 'pushB', 'pullB', 'upperB'],
}

/** "Focus: Arms · Skipping: Legs", or null when every area is normal. */
export function describeFocus(focus: Focus = {}): string | null {
  const of = (c: AreaChoice) => AREAS.filter((a) => focus[a] === c)
  const parts = [of('focus').length ? `Focus: ${of('focus').join(', ')}` : '', of('skip').length ? `Skipping: ${of('skip').join(', ')}` : '']
  return parts.filter(Boolean).join(' · ') || null
}

/** At least one area has to be trained. */
export const focusValid = (focus: Focus = {}) => AREAS.some((a) => focus[a] !== 'skip')

/** Suggested training days for a count (0 = Sunday), spread out with rest in between where possible. */
export function defaultDays(count: number): number[] {
  return ({ 1: [1], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [0, 1, 2, 3, 4, 5, 6] } as Record<number, number[]>)[
    Math.min(Math.max(count, 1), 7)
  ]
}

/** Exercises per session for the time you have (≈8–10 min each incl. rest). New lifters do one fewer. */
export function exerciseCount(minutes: number, experience: Experience): number {
  const n = minutes <= 30 ? 4 : minutes <= 45 ? 5 : minutes <= 60 ? 6 : 7
  return experience === 'new' ? Math.max(3, n - 1) : n
}

const usable = (id: string, equipmentOf: EquipmentOf, gym: Set<string>) => {
  if (!equipmentOf.has(id)) return false
  const eq = equipmentOf.get(id)
  return eq === null || eq === undefined || eq === 'body only' || gym.has(eq)
}

/** The week: training days get sessions in order; every other day is a rest day. Always 7 days. */
export function generateSplit(a: SplitAnswers, equipmentOf: EquipmentOf): StarterDay[] {
  const gym = new Set(a.equipment)
  const focus = a.focus ?? {}
  const skipped = (area: Area) => focus[area] === 'skip'
  const focused = (area: Area) => focus[area] === 'focus'
  const days = [...new Set(a.days)].sort((x, y) => x - y).slice(0, 6)
  const keys = sessionKeys(days.length, a.experience, focus)
  const count = exerciseCount(a.minutes, a.experience)
  const compoundReps: [number, number] = a.experience === 'new' ? [8, 12] : [6, 10]
  const longSession = a.minutes >= 60

  return Array.from({ length: 7 }, (_, dow): StarterDay => {
    const i = days.indexOf(dow)
    if (i < 0) return { dayOfWeek: dow, name: 'Rest', priority: 0, rest: true, exercises: [] }
    const session = SESSIONS[keys[i]]
    const kept = session.slots.filter((s) => !skipped(s.area))
    // A day whose areas are all skipped (e.g. Push with chest, shoulders and arms off) trains what's left instead.
    const areasToday = kept.length ? [...new Set(kept.map((s) => s.area))] : AREAS.filter((x) => !skipped(x))
    // Main lifts first, then focus areas, then the rest in the session's order.
    const ordered = [...kept.filter((s) => s.main), ...kept.filter((s) => !s.main && focused(s.area)), ...kept.filter((s) => !s.main && !focused(s.area))]
    // Room left by skipped areas is filled with more work for the areas trained today (focus areas first).
    const fillers = [...areasToday.filter(focused), ...areasToday.filter((x) => !focused(x))].flatMap((x) => EXTRA[x])
    const used = new Set<string>()
    const exercises: StarterExercise[] = []
    const compounds = new Set<string>()
    for (const slot of [...ordered, ...fillers]) {
      if (exercises.length >= count) break
      const pick = slot.candidates.find((id) => !used.has(id) && usable(id, equipmentOf, gym))
      if (!pick) continue
      used.add(pick)
      if (slot.compound) compounds.add(pick)
      const base = slot.main ? (a.experience === 'experienced' && longSession ? 4 : 3) : longSession && a.experience !== 'new' ? 3 : 2
      const sets = Math.min(4, base + (focused(slot.area) ? 1 : 0))
      exercises.push({ sourceId: pick, sets, reps: slot.compound ? compoundReps : [10, 15], main: slot.main })
    }
    // A skipped area can take the day's main lift with it: the first compound left becomes the main lift.
    if (exercises.length && !exercises.some((e) => e.main)) {
      const first = exercises.find((e) => compounds.has(e.sourceId)) ?? exercises[0]
      first.main = true
      exercises.splice(exercises.indexOf(first), 1)
      exercises.unshift(first)
    }
    return { dayOfWeek: dow, name: session.name, priority: session.priority, exercises }
  })
}

/** Every exercise id the generator can pick (for the library test). */
export const ALL_SPLIT_IDS = [...new Set(Object.values(S).flat())]
