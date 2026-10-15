// TESTING TOOL (remove before other people use the app; see Backlog).
// Generates realistic past workouts from the active weekly plan so Progress/History can be tried out,
// and wipes all workouts (soft delete, so phones and Supabase both forget them).
import { localDateKey } from '@/lib/body'
import { lbToKg } from '@/lib/units'
import type { LocalStore } from './store'
import type { Exercise, PlanTemplateExercise } from './types'

export const SAMPLE_NOTE = 'Sample data'

const live = <T extends { deleted_at: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)

/** Starting weights (lb) for the owner's main lifts; everything else is guessed from equipment. */
const START_LB: Record<string, number> = {
  Barbell_Squat: 185,
  'Barbell_Bench_Press_-_Medium_Grip': 155,
  'Barbell_Incline_Bench_Press_-_Medium_Grip': 135,
  Bent_Over_Barbell_Row: 135,
  Dumbbell_Shoulder_Press: 40,
  Hack_Squat: 180,
  Leg_Press: 270,
  Romanian_Deadlift: 135,
}

function startLb(e: Exercise | undefined): number {
  if (!e) return 50
  if (e.source_id && START_LB[e.source_id]) return START_LB[e.source_id]
  const iso = e.mechanic === 'isolation'
  switch (e.equipment) {
    case 'barbell': return iso ? 50 : 95
    case 'dumbbell': return iso ? 20 : 35
    case 'cable': return iso ? 40 : 90
    case 'machine': return iso ? 70 : 120
    case 'e-z curl bar': return 50
    case 'body only': return 0
    default: return 50
  }
}

/** Adds `weeks` weeks of past sessions (up to yesterday) following the weekly plan. Returns how many. */
export async function addSampleWorkouts(store: LocalStore, weeks = 6, now = new Date()): Promise<number> {
  const { db } = store
  const template = live(await db.plan_templates.toArray()).find((t) => t.is_active)
  if (!template) throw new Error('Set up your week on the Train tab first.')
  if (live(await db.workouts.toArray()).some((w) => w.notes === SAMPLE_NOTE)) throw new Error('Sample workouts are already added.')

  const days = live(await db.plan_template_days.where('template_id').equals(template.id).toArray())
  const rowsByDay = new Map<string, PlanTemplateExercise[]>()
  for (const d of days) {
    rowsByDay.set(d.id, live(await db.plan_template_exercises.where('template_day_id').equals(d.id).toArray()).sort((a, b) => a.position - b.position))
  }
  const exercises = new Map(live(await db.exercises.toArray()).map((e) => [e.id, e]))

  let count = 0
  await db.transaction('rw', [db.workouts, db.workout_exercises, db.sets, db.outbox], async () => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    for (let daysAgo = weeks * 7; daysAgo >= 1; daysAgo--) {
      const date = new Date(today)
      date.setDate(date.getDate() - daysAgo)
      const day = days.find((d) => d.day_of_week === date.getDay())
      const rows = day ? rowsByDay.get(day.id) ?? [] : []
      if (!day || day.is_rest || !rows.length) continue

      const week = Math.floor((weeks * 7 - daysAgo) / 7) // 0 = oldest week
      const started = new Date(date)
      started.setHours(7, (daysAgo * 7) % 30, 0, 0)
      const workout = await store.insert('workouts', {
        name: day.name, started_at: started.toISOString(),
        ended_at: new Date(started.getTime() + (48 + (daysAgo % 10)) * 60_000).toISOString(),
        week_plan_day_id: null, equipment_profile_id: null, notes: SAMPLE_NOTE,
      })
      for (const [position, row] of rows.entries()) {
        const ex = exercises.get(row.exercise_id)
        const base = startLb(ex)
        const iso = ex?.mechanic === 'isolation'
        // Slow, believable progress: compounds +5 lb a week, isolation +5 lb every other week, bodyweight +1 rep a week.
        const lb = base === 0 ? 0 : base + (iso ? Math.floor(week / 2) : week) * 5
        const we = await store.insert('workout_exercises', {
          workout_id: workout.id, exercise_id: row.exercise_id, position, swapped_from_exercise_id: null, notes: null,
        })
        for (let i = 0; i < row.sets; i++) {
          const reps = base === 0 ? row.rep_min + week : Math.max(row.rep_min, row.rep_max - 2 - i)
          await store.insert('sets', {
            workout_exercise_id: we.id, position: i, set_type: 'working', weight_kg: Math.round(lbToKg(lb) * 10_000) / 10_000, reps,
            rir: null, completed_at: new Date(started.getTime() + (position * 4 + i) * 3 * 60_000).toISOString(),
          })
        }
      }
      count++
    }
  })
  return count
}

/**
 * Adds sample weigh-ins for the last `weeks` weeks (most days): ~211 lb drifting down ~0.6 lb/week with daily
 * water swings, body fat every few days. Days that already have a weigh-in are left alone.
 */
export async function addSampleWeighIns(store: LocalStore, weeks = 6, now = new Date()): Promise<number> {
  const { db } = store
  const swing = [0.8, -0.6, 1.2, -0.4, 0.3, -1.0, 0.5]
  let count = 0
  await db.transaction('rw', [db.body_measurements, db.outbox], async () => {
    for (let daysAgo = weeks * 7; daysAgo >= 1; daysAgo--) {
      if (daysAgo % 6 === 4) continue // skip some days, like real life
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo)
      const date = localDateKey(d)
      if (await db.body_measurements.where('measured_on').equals(date).first()) continue
      const lb = 211 - (weeks * 7 - daysAgo) * 0.09 + swing[daysAgo % 7]
      await store.insert('body_measurements', {
        measured_on: date, note: null, muscle_mass_kg: null,
        weight_kg: Math.round(lbToKg(lb) * 10_000) / 10_000,
        body_fat_pct: daysAgo % 3 === 0 ? Math.round((19.5 - (weeks * 7 - daysAgo) * 0.02) * 10) / 10 : null,
      })
      count++
    }
  })
  return count
}

/** Deletes every weigh-in. */
export async function deleteAllWeighIns(store: LocalStore): Promise<number> {
  const { db } = store
  return db.transaction('rw', [db.body_measurements, db.outbox], async () => {
    const rows = live(await db.body_measurements.toArray())
    for (const r of rows) await store.remove('body_measurements', r.id)
    return rows.length
  })
}

/** Deletes every workout (including one in progress) with its exercises and sets. Plan and gym are kept. */
export async function deleteAllWorkouts(store: LocalStore): Promise<number> {
  const { db } = store
  return db.transaction('rw', [db.workouts, db.workout_exercises, db.sets, db.outbox], async () => {
    const workouts = live(await db.workouts.toArray())
    for (const s of live(await db.sets.toArray())) await store.remove('sets', s.id)
    for (const we of live(await db.workout_exercises.toArray())) await store.remove('workout_exercises', we.id)
    for (const w of workouts) await store.remove('workouts', w.id)
    return workouts.length
  })
}
