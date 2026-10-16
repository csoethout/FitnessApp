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

/** One per account, keyed by the auth user id (created by the server on sign-up). No soft delete on the server. */
export type Profile = Timestamps & {
  id: string
  display_name: string | null
  sex: 'male' | 'female' | null
  birth_date: string | null // YYYY-MM-DD
  height_cm: number | null
  activity_level: 'sedentary' | 'light' | 'moderate' | 'very' | 'extra' | null
  unit_system: 'imperial' | 'metric'
  timezone: string | null
  week_start_day: number
  session_minutes_min: number | null
  session_minutes_max: number | null
  preferred_time: 'morning' | 'midday' | 'evening' | 'flexible' | null
  settings: ProfileSettings
}

export type ProfileSettings = {
  /** Your nudges on top of the calculated nutrition plan (kept when the plan recalculates). */
  nutritionAdjust?: { kcal: number; protein_g: number; fat_g: number }
  /** Accepted 2-week calorie check-ins (src/lib/planner/checkIn.ts); their kcal changes add up on top of the plan. */
  checkIns?: { date: string; rate_pct_week: number | null; change_kcal: number }[]
  /** Start the rest timer after each set (default on). */
  restTimer?: boolean
  /** Ask "reps left in the tank?" after each set (default on). "Couldn't finish" is always offered. */
  askEffort?: boolean
  /** Parts of the app you use; off = hidden (data is kept). Missing = default (see src/lib/features.ts). */
  features?: Partial<Record<'food' | 'body' | 'cardio' | 'water' | 'sleep' | 'planWeek' | 'testingTools', boolean>>
  /** Your own daily water goal in oz (null/missing = calculated from body weight) and your bottle size. */
  waterGoalOz?: number | null
  waterBottleOz?: number
}

export type Goal = Owned & {
  goal_type: 'recomp' | 'cut' | 'bulk' | 'maintain' | 'strength'
  start_date: string
  end_date: string | null
  start_weight_kg: number | null
  target_weight_kg: number | null
  target_rate_pct_week: number | null
  status: 'active' | 'completed' | 'abandoned'
}

export type Food = Timestamps & {
  id: string
  owner_id: string | null // null = shared cache (server-written); otherwise the user's own food
  source: 'usda' | 'off' | 'custom'
  source_id: string | null
  barcode: string | null
  name: string
  brand: string | null
  serving_amount: number
  serving_unit: string
  serving_grams: number | null
  kcal: number // per serving
  protein_g: number
  carbs_g: number
  fat_g: number
  // Optional label lines (per serving)
  fiber_g: number | null
  sugar_g: number | null
  sat_fat_g: number | null
  trans_fat_g: number | null
  cholesterol_mg: number | null
  sodium_mg: number | null
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type FoodLogEntry = Owned & {
  logged_on: string // local date YYYY-MM-DD
  meal_slot: MealSlot
  food_id: string | null // null = quick add
  saved_meal_id: string | null
  servings: number
  name: string
  // Snapshot per serving at the time of logging, so later edits to a food don't rewrite history.
  kcal_per_serving: number
  protein_g_per_serving: number
  carbs_g_per_serving: number
  fat_g_per_serving: number
  // Optional label lines (per serving snapshot); null when unknown
  fiber_g_per_serving: number | null
  sugar_g_per_serving: number | null
  sat_fat_g_per_serving: number | null
  trans_fat_g_per_serving: number | null
  cholesterol_mg_per_serving: number | null
  sodium_mg_per_serving: number | null
}

export type SavedMeal = Owned & { name: string; servings_yield: number; notes: string | null }
export type SavedMealItem = Owned & { saved_meal_id: string; food_id: string; servings: number; position: number }

export type NutritionTarget = Owned & {
  goal_id: string | null
  effective_from: string // local date
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  reason: 'initial' | 'biweekly_adjust' | 'manual'
}

/** Tables the app reads and writes locally, mapped to their row types. */
export type CardioActivity = 'walk' | 'run' | 'bike' | 'row' | 'swim' | 'other'
export type CardioEntry = Owned & {
  performed_on: string // local YYYY-MM-DD
  activity: CardioActivity
  duration_min: number
  distance_km: number | null // stored in km, shown in miles
  notes: string | null
}

/** One drink. The day's water is the sum of its entries. Stored in ml, shown in oz. */
export type WaterEntry = Owned & { logged_on: string; amount_ml: number }

/** One night, keyed by the morning you woke up. Clock times are local "HH:MM" (Postgres may add ":SS"). */
export type SleepEntry = Owned & { wake_date: string; bed_time: string; wake_time: string; duration_min: number; quality: number | null }

/** One week of "Plan my week" (week_start = the Sunday). Only your day settings are stored; the plan is computed. */
export type WeekPlan = Owned & { template_id: string | null; week_start: string }
export type WeekPlanDay = Owned & {
  week_plan_id: string
  plan_date: string
  status: 'normal' | 'short' | 'busy' | 'away'
  minutes_available: number | null // for "short"
  equipment_profile_id: string | null // for "away": that gym; null = no gym (bodyweight)
  source_template_day_id: string | null
  session_name: string | null
  notes: string | null
}

export type Tables = {
  profiles: Profile
  goals: Goal
  exercises: Exercise
  equipment_profiles: EquipmentProfile
  exercise_unavailable: ExerciseUnavailable
  user_exercise_settings: UserExerciseSettings
  plan_templates: PlanTemplate
  plan_template_days: PlanTemplateDay
  plan_template_exercises: PlanTemplateExercise
  week_plans: WeekPlan
  week_plan_days: WeekPlanDay
  workouts: Workout
  workout_exercises: WorkoutExercise
  sets: WorkoutSet
  cardio_entries: CardioEntry
  water_entries: WaterEntry
  sleep_entries: SleepEntry
  body_measurements: BodyMeasurement
  foods: Food
  saved_meals: SavedMeal
  saved_meal_items: SavedMealItem
  food_log_entries: FoodLogEntry
  nutrition_targets: NutritionTarget
}

export type TableName = keyof Tables

/** Sync order: parents before children, so foreign keys exist when children are pushed. */
export const SYNC_ORDER: TableName[] = [
  'profiles',
  'goals',
  'exercises',
  'equipment_profiles',
  'exercise_unavailable',
  'user_exercise_settings',
  'plan_templates',
  'plan_template_days',
  'plan_template_exercises',
  'week_plans',
  'week_plan_days',
  'workouts',
  'workout_exercises',
  'sets',
  'cardio_entries',
  'water_entries',
  'sleep_entries',
  'body_measurements',
  'foods',
  'saved_meals',
  'saved_meal_items',
  'food_log_entries',
  'nutrition_targets',
]

/**
 * Column that identifies the owner. exercises/foods use owner_id (null for shared rows);
 * profiles are keyed by the user id itself.
 */
export const OWNER_COLUMN: Record<TableName, 'user_id' | 'owner_id' | 'id'> = {
  profiles: 'id',
  goals: 'user_id',
  exercises: 'owner_id',
  equipment_profiles: 'user_id',
  exercise_unavailable: 'user_id',
  user_exercise_settings: 'user_id',
  plan_templates: 'user_id',
  plan_template_days: 'user_id',
  plan_template_exercises: 'user_id',
  week_plans: 'user_id',
  week_plan_days: 'user_id',
  workouts: 'user_id',
  workout_exercises: 'user_id',
  sets: 'user_id',
  cardio_entries: 'user_id',
  water_entries: 'user_id',
  sleep_entries: 'user_id',
  body_measurements: 'user_id',
  foods: 'owner_id',
  saved_meals: 'user_id',
  saved_meal_items: 'user_id',
  food_log_entries: 'user_id',
  nutrition_targets: 'user_id',
}
