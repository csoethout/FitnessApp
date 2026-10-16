import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MAIN_GYM_EQUIPMENT } from '@/lib/training'
import { ALL_SPLIT_IDS, defaultDays, exerciseCount, generateSplit, type EquipmentOf } from './split'

// The real exercise library: source id → equipment, parsed from the seed migration.
const library: EquipmentOf = new Map()
for (const line of readFileSync('supabase/migrations/20261015000000_seed_exercises.sql', 'utf8').split('\n')) {
  const flat = line.replace(/array\[[^\]]*\]/g, 'A').replace(/'\{\}'/g, 'A')
  const m = /^\('([^']+)', '(?:[^']|'')*', A, A, (null|'[^']*'),/.exec(flat)
  if (m) library.set(m[1], m[2] === 'null' ? null : m[2].slice(1, -1))
}

const base = { days: [1, 3, 5], minutes: 60, experience: 'returning' as const, equipment: MAIN_GYM_EQUIPMENT }
const training = (days: ReturnType<typeof generateSplit>) => days.filter((d) => !d.rest)

describe('generateSplit', () => {
  it('only uses exercises that exist in the library', () => {
    expect(library.size).toBeGreaterThan(700)
    for (const id of ALL_SPLIT_IDS) expect(library.has(id), id).toBe(true)
  })

  it('always returns 7 days, training on the chosen ones', () => {
    const week = generateSplit(base, library)
    expect(week.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(training(week).map((d) => d.dayOfWeek)).toEqual([1, 3, 5])
    expect(training(week).map((d) => d.name)).toEqual(['Push', 'Pull', 'Legs'])
  })

  it('picks the split by days per week and experience', () => {
    const names = (n: number, experience: 'new' | 'returning' = 'returning') =>
      training(generateSplit({ ...base, days: defaultDays(n), experience }, library)).map((d) => d.name)
    expect(names(2)).toEqual(['Full Body A', 'Full Body B'])
    expect(names(3, 'new')).toEqual(['Full Body A', 'Full Body B', 'Full Body C'])
    expect(names(4)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B'])
    expect(names(6)).toEqual(['Push', 'Pull', 'Legs', 'Push B', 'Pull B', 'Legs B'])
  })

  it('fits the session length and starts with a main lift', () => {
    for (const minutes of [30, 45, 60, 75]) {
      for (const d of training(generateSplit({ ...base, minutes, days: defaultDays(4) }, library))) {
        expect(d.exercises.length).toBe(exerciseCount(minutes, 'returning'))
        expect(d.exercises[0].main).toBe(true)
        expect(new Set(d.exercises.map((e) => e.sourceId)).size).toBe(d.exercises.length) // no repeats in a day
      }
    }
  })

  it('swaps to what the gym has', () => {
    const home = generateSplit({ ...base, equipment: ['dumbbell', 'body only'] }, library)
    for (const d of training(home)) {
      for (const e of d.exercises) expect(['dumbbell', 'body only', null]).toContain(library.get(e.sourceId))
      expect(d.exercises.length).toBeGreaterThanOrEqual(4)
    }
    expect(home[1].exercises[0].sourceId).toBe('Dumbbell_Bench_Press')
    const bodyweight = generateSplit({ ...base, days: defaultDays(2), equipment: ['body only'] }, library)
    expect(training(bodyweight)[0].exercises.map((e) => e.sourceId)).toContain('Bodyweight_Squat')
  })

  it('is gentler for new lifters', () => {
    const d = training(generateSplit({ ...base, experience: 'new' }, library))[0]
    expect(d.exercises.length).toBe(5)
    expect(d.exercises[0].reps).toEqual([8, 12])
    expect(d.exercises.filter((e) => !e.main).every((e) => e.sets === 2)).toBe(true)
  })

  it('skipping legs gives upper-body days only, with no leg exercises', () => {
    const legIds = new Set(['Barbell_Squat', 'Leg_Press', 'Romanian_Deadlift', 'Lying_Leg_Curls', 'Standing_Calf_Raises', 'Dumbbell_Lunges', 'Hack_Squat', 'Leg_Extensions'])
    for (const n of [2, 3, 4, 6]) {
      const week = training(generateSplit({ ...base, days: defaultDays(n), focus: { Legs: 'skip' } }, library))
      expect(week.map((d) => d.name).join()).not.toMatch(/Leg|Lower|Full/)
      for (const d of week) {
        expect(d.exercises.some((e) => legIds.has(e.sourceId))).toBe(false)
        expect(d.exercises.length).toBe(exerciseCount(60, 'returning')) // room is filled with upper-body work
        expect(d.exercises[0].main).toBe(true)
      }
    }
    expect(training(generateSplit({ ...base, days: defaultDays(3), focus: { Legs: 'skip' } }, library)).map((d) => d.name)).toEqual(['Push', 'Pull', 'Upper A'])
  })

  it('skipping an area removes it everywhere and still leaves a main lift', () => {
    const week = training(generateSplit({ ...base, days: defaultDays(4), focus: { Chest: 'skip', Core: 'skip' } }, library))
    const all = week.flatMap((d) => d.exercises.map((e) => e.sourceId))
    for (const id of ['Barbell_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'Cable_Crossover', 'Cable_Crunch']) expect(all).not.toContain(id)
    for (const d of week) expect(d.exercises.filter((e) => e.main).length).toBeGreaterThan(0)
  })

  it('focus areas come right after the main lifts with an extra set', () => {
    const plain = training(generateSplit({ ...base, days: defaultDays(4) }, library))[0]
    const armDay = training(generateSplit({ ...base, days: defaultDays(4), focus: { Arms: 'focus' } }, library))[0]
    const firstNonMain = armDay.exercises.find((e) => !e.main)!
    expect(['Triceps_Pushdown_-_Rope_Attachment', 'Barbell_Curl']).toContain(firstNonMain.sourceId)
    expect(firstNonMain.sets).toBe(4)
    const armIds = (d: typeof plain) => d.exercises.filter((e) => /Curl|Triceps|Skullcrusher/.test(e.sourceId)).length
    expect(armIds(armDay)).toBeGreaterThanOrEqual(armIds(plain))
  })

  it('legs only: every day is a leg day', () => {
    const week = training(generateSplit({ ...base, days: defaultDays(3), focus: { Chest: 'skip', Back: 'skip', Shoulders: 'skip', Arms: 'skip' } }, library))
    expect(week.map((d) => d.name)).toEqual(['Lower A', 'Lower B', 'Legs'])
  })
})
