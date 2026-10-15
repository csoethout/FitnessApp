// Row types mirroring supabase/migrations. Timestamps are ISO strings; weights are kg.

export type Timestamps = {
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type Owned = Timestamps & { id: string; user_id: string }

export type Exercise = Timestamps & {
  id: string
  owner_id: string | null // null = shared catalog
  source: 'free-exercise-db' | 'custom'
  source_id: string | null
  name: string
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment: string | null
  mechanic: 'compound' | 'isolation' | null
  force: 'push' | 'pull' | 'static' | null
  level: string | null
  category: string | null
  images: string[]
}

export type EquipmentProfile = Owned & {
  name: string
  equipment: string[]
  is_default: boolean
}

export type ExerciseUnavailable = Owned & {
  equipment_profile_id: string
  exercise_id: string
}

export type UserExerciseSettings = Owned & {
  exercise_id: string
  rep_min: number | null
  rep_max: number | null
  increment_kg: number | null
  rest_seconds: number | null
  notes: string | null
}

export type PlanTemplate = Owned & {
  goal_id: string | null
  name: string
  split_type: 'full_body' | 'upper_lower' | 'ppl' | 'custom'
  is_active: boolean
}

export type PlanTemplateDay = Owned & {
  template_id: string
  day_of_week: number // 0 = Sunday
  name: string
  priority: number
  is_rest: boolean
}

export type PlanTemplateExercise = Owned & {
  template_day_id: string
  exercise_id: string
  position: number
  sets: number
  rep_min: number
  rep_max: number
  is_main_lift: boolean
  rest_seconds: number | null
}

export type Workout = Owned & {
  week_plan_day_id: string | null
  name: string | null
  started_at: string
  ended_at: string | null
  equipment_profile_id: string | null
  notes: string | null
}

export type WorkoutExercise = Owned & {
  workout_id: string
  exercise_id: string
  position: number
  swapped_from_exercise_id: string | null
  notes: string | null
}

export type SetType = 'warmup' | 'working' | 'limited'

export type WorkoutSet = Owned & {
  workout_exercise_id: string
  position: number
  set_type: SetType
  weight_kg: number
  reps: number
  rir: number | null
  completed_at: string | null // null = planned, not done yet
}

export type BodyMeasurement = Owned & {
  measured_on: string // local date YYYY-MM-DD, one row per day
  weight_kg: number | null
  body_fat_pct: number | null
  muscle_mass_kg: number | null
  note: string | null
}

/** Tables the app reads and writes locally, mapped to their row types. */
export type Tables = {
  exercises: Exercise
  equipment_profiles: EquipmentProfile
  exercise_unavailable: ExerciseUnavailable
  user_exercise_settings: UserExerciseSettings
  plan_templates: PlanTemplate
  plan_template_days: PlanTemplateDay
  plan_template_exercises: PlanTemplateExercise
  workouts: Workout
  workout_exercises: WorkoutExercise
  sets: WorkoutSet
  body_measurements: BodyMeasurement
}

export type TableName = keyof Tables

/** Sync order: parents before children, so foreign keys exist when children are pushed. */
export const SYNC_ORDER: TableName[] = [
  'exercises',
  'equipment_profiles',
  'exercise_unavailable',
  'user_exercise_settings',
  'plan_templates',
  'plan_template_days',
  'plan_template_exercises',
  'workouts',
  'workout_exercises',
  'sets',
  'body_measurements',
]

/** Column that identifies the owner. The exercises table uses owner_id (null for the shared catalog). */
export const OWNER_COLUMN: Record<TableName, 'user_id' | 'owner_id'> = {
  exercises: 'owner_id',
  equipment_profiles: 'user_id',
  exercise_unavailable: 'user_id',
  user_exercise_settings: 'user_id',
  plan_templates: 'user_id',
  plan_template_days: 'user_id',
  plan_template_exercises: 'user_id',
  workouts: 'user_id',
  workout_exercises: 'user_id',
  sets: 'user_id',
  body_measurements: 'user_id',
}
