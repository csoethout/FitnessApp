import { strToU8, zipSync } from 'fflate'
import { localDateKey } from '@/lib/body'
import { kmToMi } from '@/lib/cardio'
import { hhmm } from '@/lib/sleep'
import { mlToOz } from '@/lib/water'
import { objectsToCsv, toCsv } from '@/lib/csv'
import { EXTRA_NUTRIENTS, entryCol } from '@/lib/nutrition'
import { kgToLb } from '@/lib/units'
import type { LocalDb } from './db'
import { SYNC_ORDER, type Exercise } from './types'

const live = <T extends { deleted_at?: string | null }>(rows: T[]) => rows.filter((r) => !r.deleted_at)
const lb = (kg: number | null) => (kg === null ? null : Math.round(kgToLb(kg) * 10) / 10)
const r1 = (n: number) => Math.round(n * 10) / 10
const localTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('sv-SE').slice(0, 16) : null) // "2026-10-15 07:42"

const README = `Soev's Strength Lab export
==========================
Readable files (US units, your local dates and times):
  workouts.csv  one row per workout (duration, sets done, volume in lb)
  sets.csv      one row per completed set (weight in lb; set_type warmup / working / limited = "couldn't finish")
  body.csv      weigh-ins (lb, body fat %, muscle mass lb)
  food.csv      food log, one row per entry; nutrients are totals for the servings eaten
  cardio.csv    walks, runs and other cardio (minutes, miles)
  targets.csv   daily calorie and macro targets over time
  water.csv     water per day (oz)
  sleep.csv     one row per night, dated by the morning you woke up (minutes asleep, quality 1-5)

raw/  every table exactly as stored (weights in kg, distances in km, times in UTC), for re-importing or analysis.
Deleted rows are left out.
`

export type ExportFile = { filename: string; blob: Blob; summary: string }

/** Everything on this phone (which mirrors your account once synced) as a zip of CSV files. */
export async function buildExport(db: LocalDb, userId: string, today = localDateKey(new Date())): Promise<ExportFile> {
  const raw: Record<string, Record<string, unknown>[]> = {}
  for (const table of SYNC_ORDER) {
    let rows = live((await db[table].toArray()) as unknown as Record<string, unknown>[])
    if (table === 'exercises') rows = rows.filter((r) => r.owner_id === userId) // the shared library isn't yours
    raw[table] = rows
  }
  const exercises = new Map((await db.exercises.toArray()).map((e: Exercise) => [e.id, e.name]))
  const workouts = live(await db.workouts.toArray()).sort((a, b) => a.started_at.localeCompare(b.started_at))
  const wes = live(await db.workout_exercises.toArray())
  const sets = live(await db.sets.toArray()).filter((s) => s.completed_at)

  const setRows: (string | number | null)[][] = []
  const workoutRows: (string | number | null)[][] = []
  for (const w of workouts) {
    const date = localDateKey(new Date(w.started_at))
    let count = 0
    let volume = 0
    for (const we of wes.filter((x) => x.workout_id === w.id).sort((a, b) => a.position - b.position)) {
      let n = 0
      for (const s of sets.filter((x) => x.workout_exercise_id === we.id).sort((a, b) => a.position - b.position)) {
        n += 1
        count += 1
        if (s.set_type !== 'warmup') volume += kgToLb(s.weight_kg) * s.reps
        setRows.push([date, w.name, exercises.get(we.exercise_id) ?? we.exercise_id, n, s.set_type, lb(s.weight_kg), s.reps, s.rir, localTime(s.completed_at), w.id])
      }
    }
    const minutes = w.ended_at ? Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000) : null
    workoutRows.push([date, w.name, localTime(w.started_at), localTime(w.ended_at), minutes, count, Math.round(volume), w.id])
  }

  const body = live(await db.body_measurements.toArray()).sort((a, b) => a.measured_on.localeCompare(b.measured_on))
  const food = live(await db.food_log_entries.toArray()).sort((a, b) => a.logged_on.localeCompare(b.logged_on) || a.created_at.localeCompare(b.created_at))
  const cardio = live(await db.cardio_entries.toArray()).sort((a, b) => a.performed_on.localeCompare(b.performed_on))
  const targets = live(await db.nutrition_targets.toArray()).sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  const waterByDay = new Map<string, number>()
  for (const w of live(await db.water_entries.toArray())) waterByDay.set(w.logged_on, (waterByDay.get(w.logged_on) ?? 0) + w.amount_ml)
  const water = [...waterByDay].sort(([a], [b]) => a.localeCompare(b))
  const sleep = live(await db.sleep_entries.toArray()).sort((a, b) => a.wake_date.localeCompare(b.wake_date))
  const extraCols = EXTRA_NUTRIENTS.map((x) => `${x.key}_${x.unit}`)

  const files: Record<string, Uint8Array> = {
    'README.txt': strToU8(README),
    'workouts.csv': strToU8(toCsv(['date', 'workout', 'started', 'ended', 'minutes', 'sets_done', 'volume_lb', 'workout_id'], workoutRows)),
    'sets.csv': strToU8(toCsv(['date', 'workout', 'exercise', 'set', 'set_type', 'weight_lb', 'reps', 'reps_in_reserve', 'completed', 'workout_id'], setRows)),
    'body.csv': strToU8(toCsv(['date', 'weight_lb', 'body_fat_pct', 'muscle_mass_lb', 'note'], body.map((m) => [m.measured_on, lb(m.weight_kg), m.body_fat_pct, lb(m.muscle_mass_kg), m.note]))),
    'food.csv': strToU8(
      toCsv(
        ['date', 'meal', 'name', 'servings', 'kcal', 'protein_g', 'carbs_g', 'fat_g', ...extraCols],
        food.map((e) => [
          e.logged_on, e.meal_slot, e.name, e.servings, Math.round(e.kcal_per_serving * e.servings), r1(e.protein_g_per_serving * e.servings),
          r1(e.carbs_g_per_serving * e.servings), r1(e.fat_g_per_serving * e.servings),
          ...EXTRA_NUTRIENTS.map((x) => {
            const v = (e as unknown as Record<string, number | null>)[entryCol(x.key)]
            return v === null || v === undefined ? null : r1(v * e.servings)
          }),
        ]),
      ),
    ),
    'cardio.csv': strToU8(toCsv(['date', 'activity', 'minutes', 'miles', 'notes'], cardio.map((c) => [c.performed_on, c.activity, c.duration_min, c.distance_km === null ? null : Math.round(kmToMi(c.distance_km) * 100) / 100, c.notes]))),
    'water.csv': strToU8(toCsv(['date', 'water_oz'], water.map(([d, ml]) => [d, Math.round(mlToOz(ml))]))),
    'sleep.csv': strToU8(toCsv(['woke_on', 'bedtime', 'wake_time', 'minutes_asleep', 'quality_1_5'], sleep.map((n) => [n.wake_date, hhmm(n.bed_time), hhmm(n.wake_time), n.duration_min, n.quality]))),
    'targets.csv': strToU8(toCsv(['from', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'reason'], targets.map((t) => [t.effective_from, t.kcal, t.protein_g, t.carbs_g, t.fat_g, t.reason]))),
  }
  for (const [table, rows] of Object.entries(raw)) files[`raw/${table}.csv`] = strToU8(objectsToCsv(rows))

  const zip = zipSync(files, { level: 6 })
  const summary = `${workouts.length} workouts · ${sets.length} sets · ${body.length} weigh-ins · ${food.length} food entries · ${cardio.length} cardio`
  return { filename: `soevs-strength-lab-export-${today}.zip`, blob: new Blob([zip], { type: 'application/zip' }), summary }
}
