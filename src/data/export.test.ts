import 'fake-indexeddb/auto'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { lbToKg } from '@/lib/units'
import { openLocalDb } from './db'
import { buildExport } from './export'
import { createCustomFood, logFood } from './food'
import { saveSleep } from './sleep'
import { LocalStore } from './store'
import { logWater } from './water'

describe('data export', () => {
  it('zips readable CSVs (lb, miles, totals) and every table raw, without deleted rows', async () => {
    const store = new LocalStore(openLocalDb(`x-${crypto.randomUUID()}`), 'user-1')
    await store.db.exercises.put({
      id: 'sq', owner_id: null, source: 'free-exercise-db', source_id: 'Barbell_Squat', name: 'Barbell Squat', primary_muscles: ['quadriceps'],
      secondary_muscles: [], equipment: 'barbell', mechanic: 'compound', force: 'push', level: 'beginner', category: 'strength', images: [],
      created_at: '', updated_at: '', deleted_at: null,
    })
    const w = await store.insert('workouts', { name: 'Legs', started_at: '2026-10-15T12:00:00Z', ended_at: '2026-10-15T12:50:00Z', week_plan_day_id: null, equipment_profile_id: null, notes: null })
    const we = await store.insert('workout_exercises', { workout_id: w.id, exercise_id: 'sq', position: 0, swapped_from_exercise_id: null, notes: null })
    await store.insert('sets', { workout_exercise_id: we.id, position: 0, set_type: 'working', weight_kg: lbToKg(225), reps: 8, rir: 2, completed_at: '2026-10-15T12:10:00Z' })
    await store.insert('sets', { workout_exercise_id: we.id, position: 1, set_type: 'working', weight_kg: lbToKg(225), reps: 8, rir: null, completed_at: null }) // not done
    const food = await createCustomFood(store, {
      name: 'Eggs, large', brand: null, serving_amount: 1, serving_unit: 'egg', serving_grams: 50, kcal: 70, protein_g: 6, carbs_g: 0.5, fat_g: 5, fiber_g: null, barcode: null, sodium_mg: 70,
    })
    await logFood(store, '2026-10-15', 'breakfast', food, 4)
    const gone = await logFood(store, '2026-10-15', 'lunch', food, 1)
    await store.remove('food_log_entries', gone.id)
    await store.insert('cardio_entries', { performed_on: '2026-10-15', activity: 'walk', duration_min: 20, distance_km: 1.609, notes: null })
    await logWater(store, '2026-10-15', 24)
    await logWater(store, '2026-10-15', 8)
    await saveSleep(store, '2026-10-15', { bed_time: '23:15', wake_time: '06:45', quality: 4 })

    const out = await buildExport(store.db, 'user-1', '2026-10-15')
    expect(out.filename).toBe('soevs-strength-lab-export-2026-10-15.zip')
    expect(out.summary).toBe('1 workouts · 1 sets · 0 weigh-ins · 1 food entries · 1 cardio')
    const files = unzipSync(new Uint8Array(await out.blob.arrayBuffer()))
    const read = (n: string) => strFromU8(files[n]).trim().split('\r\n')
    expect(Object.keys(files)).toContain('raw/sets.csv')
    expect(read('water.csv')).toEqual(['date,water_oz', '2026-10-15,32'])
    expect(read('sleep.csv')).toEqual(['woke_on,bedtime,wake_time,minutes_asleep,quality_1_5', '2026-10-15,23:15,06:45,450,4'])
    expect(read('sets.csv')[1]).toMatch(/^2026-10-15,Legs,Barbell Squat,1,working,225,8,2,/)
    expect(read('workouts.csv')[1]).toMatch(/^2026-10-15,Legs,.*,50,1,1800,/)
    expect(read('food.csv')).toEqual([
      'date,meal,name,servings,kcal,protein_g,carbs_g,fat_g,fiber_g,sugar_g,sat_fat_g,trans_fat_g,cholesterol_mg,sodium_mg',
      '2026-10-15,breakfast,"Eggs, large",4,280,24,2,20,,,,,,280',
    ])
    expect(read('cardio.csv')[1]).toBe('2026-10-15,walk,20,1,')
    expect(read('raw/exercises.csv')).toHaveLength(1) // header only: the shared library isn't exported
    expect(read('raw/food_log_entries.csv')).toHaveLength(2) // deleted entry left out
  })
})
