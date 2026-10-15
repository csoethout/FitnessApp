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
  fiber_g: number | null
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
  foods: Food
  saved_meals: SavedMeal
  saved_meal_items: SavedMealItem
  food_log_entries: FoodLogEntry
  nutrition_targets: NutritionTarget
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
  'foods',
  'saved_meals',
  'saved_meal_items',
  'food_log_entries',
  'nutrition_targets',
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
  foods: 'owner_id',
  saved_meals: 'user_id',
  saved_meal_items: 'user_id',
  food_log_entries: 'user_id',
  nutrition_targets: 'user_id',
}
