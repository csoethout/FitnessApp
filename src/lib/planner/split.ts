// Rules-based weekly split for new users (setup wizard). Pure: answers + exercise library in, starter days out.
// The result goes through applyStarterSplit (or replaces the active week), after which the rows are the user's own.
import type { StarterDay, StarterExercise } from '@/lib/starterSplit'

export type Experience = 'new' | 'returning' | 'experienced'
export type SplitAnswers = {
  days: number[] // training days of the week, 0 = Sunday
  minutes: number // per session
  experience: Experience
  equipment: string[] // the usual gym's equipment ('body only' etc.)
}

/** Exercise library lookup: source id → its equipment (null = none needed). Missing = not in the library. */
export type EquipmentOf = Map<string, string | null>

type Slot = { candidates: string[]; compound: boolean; main?: boolean }

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

const main = (c: string[]): Slot => ({ candidates: c, compound: true, main: true })
const comp = (c: string[]): Slot => ({ candidates: c, compound: true })
const iso = (c: string[]): Slot => ({ candidates: c, compound: false })

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
export function sessionKeys(count: number, experience: Experience): string[] {
  switch (Math.min(Math.max(count, 1), 6)) {
    case 1: return ['fullA']
    case 2: return ['fullA', 'fullB']
    case 3: return experience === 'new' ? ['fullA', 'fullB', 'fullC'] : ['push', 'pull', 'legs']
    case 4: return ['upperA', 'lowerA', 'upperB', 'lowerB']
    case 5: return ['upperA', 'lowerA', 'push', 'pull', 'legs']
    default: return ['push', 'pull', 'legs', 'pushB', 'pullB', 'legsB']
  }
}

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
  const days = [...new Set(a.days)].sort((x, y) => x - y).slice(0, 6)
  const keys = sessionKeys(days.length, a.experience)
  const count = exerciseCount(a.minutes, a.experience)
  const compoundReps: [number, number] = a.experience === 'new' ? [8, 12] : [6, 10]
  const longSession = a.minutes >= 60

  return Array.from({ length: 7 }, (_, dow): StarterDay => {
    const i = days.indexOf(dow)
    if (i < 0) return { dayOfWeek: dow, name: 'Rest', priority: 0, rest: true, exercises: [] }
    const session = SESSIONS[keys[i]]
    const used = new Set<string>()
    const exercises: StarterExercise[] = []
    for (const slot of session.slots) {
      if (exercises.length >= count) break
      const pick = slot.candidates.find((id) => !used.has(id) && usable(id, equipmentOf, gym))
      if (!pick) continue
      used.add(pick)
      const sets = slot.main ? (a.experience === 'experienced' && longSession ? 4 : 3) : longSession && a.experience !== 'new' ? 3 : 2
      exercises.push({ sourceId: pick, sets, reps: slot.compound ? compoundReps : [10, 15], main: slot.main })
    }
    return { dayOfWeek: dow, name: session.name, priority: session.priority, exercises }
  })
}

/** Every exercise id the generator can pick (for the library test). */
export const ALL_SPLIT_IDS = [...new Set(Object.values(S).flat())]
