import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/data/types'
import { defaultRepRange, defaultRestSeconds, filterExercises } from './training'

const ex = (name: string, extra: Partial<Exercise> = {}): Exercise => ({
  id: name, owner_id: null, source: 'free-exercise-db', source_id: name, name, primary_muscles: ['chest'],
  secondary_muscles: [], equipment: 'barbell', mechanic: 'compound', force: 'push', level: 'beginner',
  category: 'strength', images: [], created_at: '', updated_at: '', deleted_at: null, ...extra,
})

describe('defaults', () => {
  it('uses 3 / 2 / 1 minute rests', () => {
    expect(defaultRestSeconds(true, 'compound')).toBe(180)
    expect(defaultRestSeconds(false, 'compound')).toBe(120)
    expect(defaultRestSeconds(false, 'isolation')).toBe(60)
    expect(defaultRestSeconds(true, 'isolation')).toBe(180)
  })
  it('uses 6–10 for compounds and 10–15 for isolation', () => {
    expect(defaultRepRange('compound')).toEqual([6, 10])
    expect(defaultRepRange('isolation')).toEqual([10, 15])
    expect(defaultRepRange(null)).toEqual([6, 10])
  })
})

describe('filterExercises', () => {
  const all = [
    ex('Barbell Bench Press'),
    ex('Dumbbell Bench Press', { equipment: 'dumbbell' }),
    ex('Kettlebell Swing', { equipment: 'kettlebells', primary_muscles: ['hamstrings'] }),
    ex('Push-Up', { equipment: null }),
    ex('Clean and Jerk', { level: 'expert', category: 'olympic weightlifting', primary_muscles: ['shoulders'] }),
    ex('Old Press', { deleted_at: '2026-01-01' }),
  ]

  it('matches every word, in any order', () => {
    expect(filterExercises(all, { query: 'press bench' }).map((e) => e.name)).toEqual([
      'Barbell Bench Press',
      'Dumbbell Bench Press',
    ])
  })
  it('limits to available equipment but keeps no-equipment exercises', () => {
    const names = filterExercises(all, { equipment: ['barbell'] }).map((e) => e.name)
    expect(names).toContain('Push-Up')
    expect(names).not.toContain('Kettlebell Swing')
    expect(names).not.toContain('Dumbbell Bench Press')
  })
  it('filters by muscle and hides deleted rows', () => {
    expect(filterExercises(all, { muscles: ['hamstrings'] }).map((e) => e.name)).toEqual(['Kettlebell Swing'])
    expect(filterExercises(all, {}).map((e) => e.name)).not.toContain('Old Press')
  })
  it('puts expert / olympic lifts last', () => {
    expect(filterExercises(all, {}).at(-1)?.name).toBe('Clean and Jerk')
  })
})
