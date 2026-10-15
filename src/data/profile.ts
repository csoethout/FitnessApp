import { useLiveQuery } from 'dexie-react-hooks'
import { localDateKey, rollingAverage } from '@/lib/body'
import { checkInDue, checkInTotal, suggestCheckIn, type CheckIn, type CheckInSuggestion } from '@/lib/planner/checkIn'
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

/** Save the result of a check-in (a change of 0 = "keep as is"; it still resets the 2-week clock). */
export async function recordCheckIn(store: LocalStore, entry: CheckIn) {
  const profile = await store.db.profiles.get(store.userId)
  const settings = profile?.settings ?? {}
  await saveProfile(store, { settings: { ...settings, checkIns: [...(settings.checkIns ?? []), entry] } })
}

/** Undo the check-in calorie changes for the current goal (back to the calculated plan + your nudges). */
export async function resetCheckIns(store: LocalStore, goalStart: string) {
  const profile = await store.db.profiles.get(store.userId)
  const settings = profile?.settings ?? {}
  const kept = (settings.checkIns ?? []).map((c) => (c.date >= goalStart ? { ...c, change_kcal: 0 } : c))
  await saveProfile(store, { settings: { ...settings, checkIns: kept } })
}

export type CheckInState = {
  due: boolean
  suggestion: CheckInSuggestion | null // null when no plan yet
  totalKcal: number // added by check-ins since the goal started
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
  checkIn: CheckInState
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
  const checkIns = profile?.settings?.checkIns ?? []
  const totalKcal = goal ? checkInTotal(checkIns, goal.start_date) : 0
  const inputs: PlanInputs | null = missing.length
    ? null
    : {
        sex: profile!.sex!, ageYears: ageOn(profile!.birth_date!, today), heightCm: profile!.height_cm!, weightKg: weightKg!,
        activity: profile!.activity_level!, goal: goal!.goal_type,
      }
  // Check-ins ride on top of your nudges; the guardrails in computePlan apply to the total.
  const withCheckIns = (extra: number) => ({ ...adjust, kcal: adjust.kcal + totalKcal + extra })
  const plan = inputs ? computePlan(inputs, withCheckIns(0)) : null
  let suggestion: CheckInSuggestion | null = null
  if (inputs && goal) {
    suggestion = suggestCheckIn(weighIns.map((m) => ({ date: m.measured_on, value: m.weight_kg! })), weightKg!, goal.goal_type, today)
    // Already at the safety floor: a cut wouldn't change anything, so don't suggest one.
    if (suggestion.status === 'adjust' && suggestion.change < 0 && computePlan(inputs, withCheckIns(suggestion.change)).kcal === plan!.kcal) {
      suggestion = { ...suggestion, status: 'on-track', change: 0, message: `${suggestion.message.split(':')[0]}. Calories are already at the safety floor, so they stay where they are.` }
    }
  }
  return {
    profile, goal, weightKg, missing, inputs, adjust, plan,
    base: inputs ? computePlan(inputs) : null,
    checkIn: { due: !!goal && checkInDue(checkIns, goal.start_date, today), suggestion, totalKcal },
  }
}

export function useNutritionPlan() {
  const { db, store } = useData()
  return useLiveQuery(() => loadPlanState(db, store.userId, localDateKey(new Date())), [db, store.userId])
}

export type AppSettings = { restTimer: boolean; askEffort: boolean }
const DEFAULT_SETTINGS: AppSettings = { restTimer: true, askEffort: true }

/** Workout settings with defaults filled in. undefined while loading. */
export function useAppSettings(): AppSettings | undefined {
  const { db, store } = useData()
  return useLiveQuery(async () => {
    const s = (await db.profiles.get(store.userId))?.settings ?? {}
    return { restTimer: s.restTimer ?? DEFAULT_SETTINGS.restTimer, askEffort: s.askEffort ?? DEFAULT_SETTINGS.askEffort }
  }, [db, store.userId])
}

export async function saveAppSetting(store: LocalStore, changes: Partial<AppSettings>) {
  const profile = await store.db.profiles.get(store.userId)
  await saveProfile(store, { settings: { ...(profile?.settings ?? {}), ...changes } })
}
