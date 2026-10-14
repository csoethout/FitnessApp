// Starter week for the owner's split (CLAUDE.md → Owner profile). This is DATA, applied once when the user taps
// "Use starter split"; afterwards the rows belong to the user and are edited like anything else.
// The Phase 5 planner replaces this for everyone else.
// Weeks 1–2 are a ramp-in: 3 working sets on main lifts, 2–3 on accessories.

export type StarterExercise = { sourceId: string; sets: number; reps: [number, number]; main?: boolean }
export type StarterDay = { dayOfWeek: number; name: string; priority: number; rest?: boolean; exercises: StarterExercise[] }

const C: [number, number] = [6, 10] // compound
const I: [number, number] = [10, 15] // isolation

export const STARTER_SPLIT: StarterDay[] = [
  {
    dayOfWeek: 0,
    name: 'Back & Shoulders',
    priority: 4,
    exercises: [
      { sourceId: 'Dumbbell_Shoulder_Press', sets: 3, reps: C, main: true },
      { sourceId: 'Side_Lateral_Raise', sets: 3, reps: I },
      { sourceId: 'Wide-Grip_Lat_Pulldown', sets: 2, reps: C },
      { sourceId: 'Seated_Cable_Rows', sets: 2, reps: C },
      { sourceId: 'Face_Pull', sets: 2, reps: I },
      { sourceId: 'Reverse_Machine_Flyes', sets: 2, reps: I },
    ],
  },
  {
    dayOfWeek: 1,
    name: 'Legs',
    priority: 5,
    exercises: [
      { sourceId: 'Barbell_Squat', sets: 3, reps: C, main: true },
      { sourceId: 'Leg_Press', sets: 2, reps: C },
      { sourceId: 'Romanian_Deadlift', sets: 2, reps: C },
      { sourceId: 'Lying_Leg_Curls', sets: 2, reps: I },
      { sourceId: 'Standing_Calf_Raises', sets: 3, reps: I },
    ],
  },
  {
    dayOfWeek: 2,
    name: 'Chest',
    priority: 5,
    exercises: [
      { sourceId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 3, reps: C, main: true },
      { sourceId: 'Incline_Dumbbell_Press', sets: 3, reps: C },
      { sourceId: 'Cable_Crossover', sets: 2, reps: I },
      { sourceId: 'Butterfly', sets: 2, reps: I },
      { sourceId: 'Triceps_Pushdown', sets: 2, reps: I },
    ],
  },
  {
    dayOfWeek: 3,
    name: 'Back',
    priority: 3,
    exercises: [
      { sourceId: 'Bent_Over_Barbell_Row', sets: 3, reps: C, main: true },
      { sourceId: 'Close-Grip_Front_Lat_Pulldown', sets: 2, reps: C },
      { sourceId: 'One-Arm_Dumbbell_Row', sets: 2, reps: C },
      { sourceId: 'Straight-Arm_Pulldown', sets: 2, reps: I },
      { sourceId: 'Hyperextensions_Back_Extensions', sets: 2, reps: I },
      { sourceId: 'Barbell_Shrug', sets: 2, reps: I },
    ],
  },
  {
    dayOfWeek: 4,
    name: 'Arms & Abs',
    priority: 2,
    exercises: [
      { sourceId: 'Barbell_Curl', sets: 3, reps: I },
      { sourceId: 'Triceps_Pushdown_-_Rope_Attachment', sets: 3, reps: I },
      { sourceId: 'Hammer_Curls', sets: 2, reps: I },
      { sourceId: 'EZ-Bar_Skullcrusher', sets: 2, reps: I },
      { sourceId: 'Cable_Crunch', sets: 3, reps: I },
      { sourceId: 'Hanging_Leg_Raise', sets: 2, reps: I },
    ],
  },
  { dayOfWeek: 5, name: 'Rest', priority: 0, rest: true, exercises: [] },
  {
    dayOfWeek: 6,
    name: 'Full Body',
    priority: 3,
    exercises: [
      { sourceId: 'Barbell_Incline_Bench_Press_-_Medium_Grip', sets: 3, reps: C, main: true },
      { sourceId: 'Hack_Squat', sets: 3, reps: C, main: true },
      { sourceId: 'Dumbbell_Lunges', sets: 2, reps: C },
      { sourceId: 'Wide-Grip_Lat_Pulldown', sets: 2, reps: C },
      { sourceId: 'Leg_Extensions', sets: 2, reps: I },
      { sourceId: 'Butterfly', sets: 2, reps: I },
    ],
  },
]
