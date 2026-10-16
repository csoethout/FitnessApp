import { useLiveQuery } from 'dexie-react-hooks'
import { localDateKey, rollingAverage } from '@/lib/body'
import type { Features } from '@/lib/features'
import type { ActivityLevel, GoalType, Sex } from '@/lib/planner/nutrition'
import { generateSplit, type EquipmentOf, type Experience } from '@/lib/planner/split'
import { kgToLb, lbToKg } from '@/lib/units'
import { saveWeighIn } from './body'
import { useData, useFirstSyncDone } from './DataProvider'
import type { LocalDb } from './db'
import { activeGoal, saveProfile, setGoal } from './profile'
import { ensureMainGym, replaceWeek } from './setup'
import type { LocalStore } from './store'

/** Everything the setup wizard asks. */
export type SetupAnswers = {
  name: string
  sex: Sex | null
  birthDate: string
  heightIn: number
  weightLb: number
  activity: ActivityLevel
  goal: GoalType
  days: number[]
  minutes: number
  experience: Experience
  gymEquipment: string[]
  features: Features
  week: 'new' | 'keep' // keep = leave an existing weekly plan alone
}

/** Starting answers: what the account already has, else neutral middles (nothing about the owner). */
export async function loadSetupDefaults(db: LocalDb, userId: string, features: Features) {
  const profile = await db.profiles.get(userId)
  const weighIns = (await db.body_measurements.orderBy('measured_on').toArray()).filter((m) => !m.deleted_at && m.weight_kg !== null)
  const weightKg = rollingAverage(weighIns.map((m) => ({ date: m.measured_on, value: m.weight_kg! }))).at(-1)?.value ?? null
  const goal = await activeGoal(db)
  const gym = (await db.equipment_profiles.toArray()).find((g) => g.is_default && !g.deleted_at)
  const template = (await db.plan_templates.toArray()).find((t) => t.is_active && !t.deleted_at)
  const trainingDays = template
    ? (await db.plan_template_days.where('template_id').equals(template.id).toArray()).filter((d) => !d.deleted_at && !d.is_rest).map((d) => d.day_of_week)
    : []
  const answers: SetupAnswers = {
    name: profile?.display_name ?? '',
    sex: profile?.sex ?? null,
    birthDate: profile?.birth_date ?? '',
    heightIn: profile?.height_cm ? Math.round(profile.height_cm / 2.54) : 69,
    weightLb: weightKg ? Math.round(kgToLb(weightKg)) : 170,
    activity: profile?.activity_level ?? 'moderate',
    goal: goal?.goal_type ?? 'recomp',
    days: trainingDays.length ? trainingDays.sort() : [1, 3, 5],
    minutes: profile?.session_minutes_max ?? 60,
    experience: profile?.settings?.experience ?? 'returning',
    gymEquipment: gym?.equipment ?? [],
    features,
    week: template ? 'keep' : 'new',
  }
  // A rerun (from More): you can close the wizard without changing anything.
  const rerun = !!profile?.settings?.setupDone || !!template
  return { answers, hasWeek: !!template, hasWeight: weightKg !== null, rerun }
}

/** Source id → equipment for the whole library (for the week generator). */
export async function loadEquipmentOf(db: LocalDb): Promise<EquipmentOf> {
  return new Map((await db.exercises.toArray()).filter((e) => !e.owner_id && e.source_id && !e.deleted_at).map((e) => [e.source_id!, e.equipment]))
}

/** Save the wizard: profile, today's weight (if new), goal, usual gym, features, and the generated week. */
export async function applySetup(store: LocalStore, a: SetupAnswers, opts: { hasWeight: boolean }) {
  const { db } = store
  const today = localDateKey(new Date())
  const settings = (await db.profiles.get(store.userId))?.settings ?? {}
  await saveProfile(store, {
    display_name: a.name.trim() || null, sex: a.sex, birth_date: a.birthDate || null,
    height_cm: Math.round(a.heightIn * 2.54 * 10) / 10, activity_level: a.activity,
    session_minutes_min: a.minutes, session_minutes_max: a.minutes,
    settings: { ...settings, features: { ...settings.features, ...a.features }, experience: a.experience, setupDone: today },
  })
  let weightKg: number | null = null
  if (!opts.hasWeight) {
    weightKg = Math.round(lbToKg(a.weightLb) * 10_000) / 10_000
    await saveWeighIn(store, today, { weight_kg: weightKg, body_fat_pct: null, muscle_mass_kg: null })
  }
  await setGoal(store, a.goal, today, weightKg ?? (await currentWeightKg(db)))

  const gymId = await ensureMainGym(store)
  if (a.gymEquipment.length) await store.update('equipment_profiles', gymId, { equipment: a.gymEquipment })

  if (a.week === 'new') {
    const week = generateSplit({ days: a.days, minutes: a.minutes, experience: a.experience, equipment: a.gymEquipment }, await loadEquipmentOf(db))
    await replaceWeek(store, week)
  }
}

async function currentWeightKg(db: LocalDb) {
  const w = (await db.body_measurements.orderBy('measured_on').toArray()).filter((m) => !m.deleted_at && m.weight_kg !== null)
  return rollingAverage(w.map((m) => ({ date: m.measured_on, value: m.weight_kg! }))).at(-1)?.value ?? null
}

/** Mark setup as done without answering (the "Skip" link). */
export async function skipSetup(store: LocalStore) {
  const settings = (await store.db.profiles.get(store.userId))?.settings ?? {}
  await saveProfile(store, { settings: { ...settings, setupDone: localDateKey(new Date()) } })
}

/**
 * New accounts go to the wizard: never set up, no weekly plan and no workouts. Existing users (who set things up
 * before the wizard existed) are left alone. Waits for this phone's first download so we don't guess too early.
 */
export function useNeedsSetup(): boolean | undefined {
  const { db, store } = useData()
  const synced = useFirstSyncDone()
  return useLiveQuery(async () => {
    if (!synced) return undefined
    if ((await db.profiles.get(store.userId))?.settings?.setupDone) return false
    if ((await db.plan_templates.toArray()).some((t) => t.is_active && !t.deleted_at)) return false
    return !(await db.workouts.toArray()).some((w) => !w.deleted_at)
  }, [db, store.userId, synced])
}
