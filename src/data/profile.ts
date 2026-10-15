import { useLiveQuery } from 'dexie-react-hooks'
import { localDateKey, rollingAverage } from '@/lib/body'
import { ageOn, computePlan, GOALS, type Adjustments, type GoalType, type NutritionPlan, type PlanInputs } from '@/lib/planner/nutrition'
import { useData } from './DataProvider'
import type { LocalDb } from './db'
import type { LocalStore } from './store'
import type { Goal, Profile } from './types'

const NO_ADJUST: Adjustments = { kcal: 0, protein_g: 0, fat_g: 0 }

/** Update your profile (creating the local copy if it hasn't synced down yet). */
export async function saveProfile(store: LocalStore, changes: Partial<Profile>) {
  const existing = await store.db.profiles.get(store.userId)
  if (existing) return store.update('profiles', store.userId, changes)
  return store.insert('profiles', {
    display_name: null, sex: null, birth_date: null, height_cm: null, activity_level: null, unit_system: 'imperial',
    timezone: null, week_start_day: 0, session_minutes_min: null, session_minutes_max: null, preferred_time: null, settings: {},
    ...changes,
  })
}

export async function activeGoal(db: LocalDb): Promise<Goal | null> {
  return (await db.goals.toArray()).find((g) => g.status === 'active' && !g.deleted_at) ?? null
}

/** Set the goal. Changes the active goal in place (the server allows one active goal at a time). */
export async function setGoal(store: LocalStore, goalType: GoalType, today: string, weightKg: number | null) {
  const current = await activeGoal(store.db)
  const rate = GOALS[goalType].ratePctWeek
  if (current) {
    if (current.goal_type === goalType) return current
    return store.update('goals', current.id, { goal_type: goalType, target_rate_pct_week: rate, start_date: today, start_weight_kg: weightKg })
  }
  return store.insert('goals', {
    goal_type: goalType, start_date: today, end_date: null, start_weight_kg: weightKg, target_weight_kg: null,
    target_rate_pct_week: rate, status: 'active',
  })
}

export async function setNutritionAdjust(store: LocalStore, adjust: Adjustments) {
  const profile = await store.db.profiles.get(store.userId)
  await saveProfile(store, { settings: { ...(profile?.settings ?? {}), nutritionAdjust: adjust } })
}

export type PlanState = {
  profile: Profile | null
  goal: Goal | null
  weightKg: number | null // 7-day average of weigh-ins
  missing: string[] // what's needed before a plan can be calculated
  inputs: PlanInputs | null
  adjust: Adjustments
  plan: NutritionPlan | null // with your nudges applied
  base: NutritionPlan | null // the plan before nudges
}

export async function loadPlanState(db: LocalDb, userId: string, today: string): Promise<PlanState> {
  const profile = (await db.profiles.get(userId)) ?? null
  const goal = await activeGoal(db)
  const weighIns = (await db.body_measurements.orderBy('measured_on').toArray()).filter((m) => !m.deleted_at && m.weight_kg !== null && m.measured_on <= today)
  const weightKg = rollingAverage(weighIns.map((m) => ({ date: m.measured_on, value: m.weight_kg! }))).at(-1)?.value ?? null

  const missing: string[] = []
  if (!profile?.sex) missing.push('sex')
  if (!profile?.birth_date) missing.push('birth date')
  if (!profile?.height_cm) missing.push('height')
  if (!profile?.activity_level) missing.push('activity')
  if (!goal) missing.push('goal')
  if (weightKg === null) missing.push('weight')

  const adjust = profile?.settings?.nutritionAdjust ?? NO_ADJUST
  const inputs: PlanInputs | null = missing.length
    ? null
    : {
        sex: profile!.sex!, ageYears: ageOn(profile!.birth_date!, today), heightCm: profile!.height_cm!, weightKg: weightKg!,
        activity: profile!.activity_level!, goal: goal!.goal_type,
      }
  return {
    profile, goal, weightKg, missing, inputs, adjust,
    plan: inputs ? computePlan(inputs, adjust) : null,
    base: inputs ? computePlan(inputs) : null,
  }
}

export function useNutritionPlan() {
  const { db, store } = useData()
  return useLiveQuery(() => loadPlanState(db, store.userId, localDateKey(new Date())), [db, store.userId])
}
