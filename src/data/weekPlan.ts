import { useLiveQuery } from 'dexie-react-hooks'
import { addDaysKey } from '@/lib/nutrition'
import { localDateKey } from '@/lib/body'
import { planWeek, type DayInput, type PlannedDay, type TemplateDay } from '@/lib/planner/week'
import { useData } from './DataProvider'
import type { LocalDb } from './db'
import type { LocalStore } from './store'
import type { EquipmentProfile, WeekPlan, WeekPlanDay } from './types'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)
const NO_GYM = ['body only'] // away with no gym: bodyweight exercises only

/** The Sunday that starts the week containing `date` (owner's weeks start on Sunday). */
export function weekStartOf(date: string): string {
  return addDaysKey(date, -new Date(date + 'T12:00:00').getDay())
}

export type WeekView = {
  weekStart: string
  plan: WeekPlan | null // null until you open Plan my week for this week
  rows: Map<string, WeekPlanDay> // by date
  days: PlannedDay[]
  gyms: EquipmentProfile[]
}

/** The template as the planner needs it (active template, days with their exercises in order). */
async function loadTemplate(db: LocalDb): Promise<{ id: string | null; days: TemplateDay[] }> {
  const template = live(await db.plan_templates.toArray()).find((t) => t.is_active)
  if (!template) return { id: null, days: [] }
  const days = live(await db.plan_template_days.where('template_id').equals(template.id).toArray())
  const rows = live(await db.plan_template_exercises.where('template_day_id').anyOf(days.map((d) => d.id)).toArray())
  return {
    id: template.id,
    days: days.map((d) => ({
      id: d.id, day_of_week: d.day_of_week, name: d.name, is_rest: d.is_rest,
      exercises: rows
        .filter((r) => r.template_day_id === d.id)
        .sort((a, b) => a.position - b.position)
        .map((r) => ({ exercise_id: r.exercise_id, sets: r.sets, rep_min: r.rep_min, rep_max: r.rep_max, is_main_lift: r.is_main_lift, rest_seconds: r.rest_seconds })),
    })),
  }
}

export async function loadWeek(db: LocalDb, weekStart: string, today: string): Promise<WeekView> {
  const [template, plans, gyms, unavailable, workouts, catalog] = await Promise.all([
    loadTemplate(db),
    db.week_plans.where('week_start').equals(weekStart).toArray(),
    db.equipment_profiles.toArray(),
    db.exercise_unavailable.toArray(),
    db.workouts.toArray(),
    db.exercises.toArray(),
  ])
  const plan = live(plans)[0] ?? null
  const rows = new Map((plan ? live(await db.week_plan_days.where('week_plan_id').equals(plan.id).toArray()) : []).map((r) => [r.plan_date, r]))
  const liveGyms = live(gyms)
  const hiddenAt = (gymId: string | undefined) => new Set(live(unavailable).filter((u) => u.equipment_profile_id === gymId).map((u) => u.exercise_id))
  const mainGym = liveGyms.find((g) => g.is_default)
  const doneDates = new Set(live(workouts).map((w) => localDateKey(new Date(w.started_at))))

  const inputs: DayInput[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysKey(weekStart, i)
    const row = rows.get(date)
    const status = row?.status ?? 'normal'
    const awayGym = status === 'away' && row?.equipment_profile_id ? liveGyms.find((g) => g.id === row.equipment_profile_id) : undefined
    return {
      date, status,
      minutes: status === 'short' ? (row?.minutes_available ?? 45) : null,
      // Normal days: your usual gym as planned (no swaps). Away: that gym's equipment, or bodyweight with no gym.
      equipment: status === 'away' ? (awayGym ? awayGym.equipment : NO_GYM) : null,
      unavailableIds: hiddenAt(status === 'away' ? awayGym?.id : mainGym?.id),
      past: date < today,
      done: doneDates.has(date),
    }
  })
  return { weekStart, plan, rows, days: planWeek(inputs, template.days, catalog), gyms: liveGyms }
}

export function useWeek(weekStart: string) {
  const { db } = useData()
  return useLiveQuery(() => loadWeek(db, weekStart, localDateKey(new Date())), [db, weekStart])
}

/** Opening Plan my week for a week creates it: one row per day, all "normal" (= the template). */
export async function ensureWeekPlan(store: LocalStore, weekStart: string): Promise<WeekPlan> {
  const { db } = store
  return db.transaction('rw', [db.week_plans, db.week_plan_days, db.plan_templates, db.outbox], async () => {
    const existing = live(await db.week_plans.where('week_start').equals(weekStart).toArray())[0]
    if (existing) return existing
    const template = live(await db.plan_templates.toArray()).find((t) => t.is_active)
    const plan = await store.insert('week_plans', { template_id: template?.id ?? null, week_start: weekStart })
    for (let i = 0; i < 7; i++) {
      await store.insert('week_plan_days', {
        week_plan_id: plan.id, plan_date: addDaysKey(weekStart, i), status: 'normal', minutes_available: null, equipment_profile_id: null,
        source_template_day_id: null, session_name: null, notes: null,
      })
    }
    return plan
  })
}

export function setDay(store: LocalStore, row: WeekPlanDay, changes: Pick<WeekPlanDay, 'status' | 'minutes_available' | 'equipment_profile_id'>) {
  return store.update('week_plan_days', row.id, changes)
}

/** Back to the template: every day "normal". */
export async function resetWeek(store: LocalStore, rows: WeekPlanDay[]) {
  for (const r of rows) {
    if (r.status !== 'normal') await store.update('week_plan_days', r.id, { status: 'normal', minutes_available: null, equipment_profile_id: null })
  }
}

/** Today's session from Plan my week, when you've planned this week; undefined while loading, null when not planned. */
export function useTodayPlan() {
  const { db } = useData()
  return useLiveQuery(async () => {
    const today = localDateKey(new Date())
    const week = await loadWeek(db, weekStartOf(today), today)
    if (!week.plan) return null
    return { day: week.days.find((d) => d.date === today)!, row: week.rows.get(today) ?? null }
  }, [db])
}
