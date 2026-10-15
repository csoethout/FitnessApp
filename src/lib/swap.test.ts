import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/data/types'
import { rankAlternatives } from './swap'

const ex = (id: string, extra: Partial<Exercise> = {}): Exercise => ({
  id, owner_id: null, source: 'free-exercise-db', source_id: id, name: id, primary_muscles: ['quadriceps'],
  secondary_muscles: ['glutes'], equipment: 'barbell', mechanic: 'compound', force: 'push', level: 'beginner',
  category: 'strength', images: [], created_at: '', updated_at: '', deleted_at: null, ...extra,
})

const squat = ex('Squat', { secondary_muscles: ['glutes', 'hamstrings'] })
const library = [
  squat,
  ex('Leg Press', { equipment: 'machine', secondary_muscles: ['glutes', 'hamstrings'] }),
  ex('Hack Squat', { equipment: 'machine' }),
  ex('Leg Extension', { equipment: 'machine', mechanic: 'isolation' }),
  ex('Kettlebell Goblet', { equipment: 'kettlebells' }),
  ex('Bench Press', { primary_muscles: ['chest'] }),
  ex('Olympic Thing', { level: 'expert', category: 'olympic weightlifting' }),
  ex('Box Jump', { category: 'plyometrics', equipment: null }),
]
const base = { equipment: ['barbell', 'machine'], unavailableIds: new Set<string>(), excludeIds: new Set<string>() }

describe('rankAlternatives', () => {
  it('keeps same-muscle exercises the gym can do, best match first', () => {
    const names = rankAlternatives(squat, library, base).map((e) => e.name)
    expect(names.slice(0, 2).sort()).toEqual(['Hack Squat', 'Leg Press']) // same muscles, compound, push
    expect(names).not.toContain('Squat')
    expect(names).not.toContain('Bench Press') // different muscle
    expect(names).not.toContain('Kettlebell Goblet') // no kettlebells at this gym
    expect(names.indexOf('Leg Extension')).toBeGreaterThan(names.indexOf('Hack Squat')) // isolation after compound
    expect(names.at(-1)).toBe('Olympic Thing')
  })

  it('leaves out exercises marked "Not at this gym" or already in the workout', () => {
    const names = rankAlternatives(squat, library, {
      ...base,
      unavailableIds: new Set(['Leg Press']),
      excludeIds: new Set(['Hack Squat']),
    }).map((e) => e.name)
    expect(names).not.toContain('Leg Press')
    expect(names).not.toContain('Hack Squat')
  })

  it('allows any equipment when no gym is set', () => {
    expect(rankAlternatives(squat, library, { ...base, equipment: null }).map((e) => e.name)).toContain('Kettlebell Goblet')
  })
})

describe('staples', () => {
  it('every staple id exists in the exercise library', async () => {
    const { readFileSync } = await import('node:fs')
    const { STAPLE_SOURCE_IDS } = await import('./staples')
    const seed = readFileSync('supabase/migrations/20261015000000_seed_exercises.sql', 'utf8')
    for (const id of STAPLE_SOURCE_IDS) expect(seed, id).toContain(`('${id}',`)
  })

  it('ranks staples above obscure exercises and sinks risky variations', () => {
    const bench = ex('Barbell_Bench_Press_-_Medium_Grip', { primary_muscles: ['chest'] })
    const names = rankAlternatives(
      bench,
      [
        ex('Barbell_Guillotine_Bench_Press', { name: 'Barbell Guillotine Bench Press', primary_muscles: ['chest'] }),
        ex('Clock_Push-Up', { name: 'Clock Push-Up', primary_muscles: ['chest'], equipment: 'body only' }),
        ex('Dumbbell_Bench_Press', { name: 'Dumbbell Bench Press', primary_muscles: ['chest'], equipment: 'dumbbell' }),
      ],
      { ...base, equipment: null },
    ).map((e) => e.name)
    expect(names).toEqual(['Dumbbell Bench Press', 'Clock Push-Up', 'Barbell Guillotine Bench Press'])
  })
})
