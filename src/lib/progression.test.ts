import { describe, expect, it } from 'vitest'
import { isBigJump, suggestNext, type HistorySet } from './progression'
import { kgToLb, lbToKg } from './units'

const done = '2026-10-10T10:00:00Z'
const session = (lb: number, reps: number[], type: HistorySet['set_type'] = 'working'): HistorySet[] =>
  reps.map((r, i) => ({ weight_kg: lbToKg(lb), reps: r, set_type: type, completed_at: done, position: i }))
const base = { sets: 3, repMin: 6, repMax: 10, bigJump: false, unit: 'lb' as const }
const lbs = (s: { weight_kg: number }[]) => s.map((x) => Math.round(kgToLb(x.weight_kg) * 10) / 10)

describe('double progression', () => {
  it('first time: no weight, bottom of the range', () => {
    const s = suggestNext({ ...base, sessions: [] })
    expect(s.kind).toBe('first')
    expect(s.sets).toEqual([{ weight_kg: 0, reps: 6 }, { weight_kg: 0, reps: 6 }, { weight_kg: 0, reps: 6 }])
  })

  it('all sets at the top → +5 lb, back to the bottom', () => {
    const s = suggestNext({ ...base, sessions: [session(185, [10, 10, 10])] })
    expect(s.kind).toBe('increase')
    expect(lbs(s.sets)).toEqual([190, 190, 190])
    expect(s.sets.map((x) => x.reps)).toEqual([6, 6, 6])
  })

  it('barbell lower body jumps 10 lb; kg users jump 2.5 / 5 kg', () => {
    expect(lbs(suggestNext({ ...base, bigJump: true, sessions: [session(225, [10, 10, 10])] }).sets)).toEqual([235, 235, 235])
    const kg = suggestNext({ ...base, unit: 'kg', sessions: [[{ weight_kg: 100, reps: 10, set_type: 'working', completed_at: done, position: 0 }]] })
    expect(kg.sets[0].weight_kg).toBe(102.5)
  })

  it('otherwise same weight, +1 rep per set, capped at the top', () => {
    const s = suggestNext({ ...base, sessions: [session(185, [10, 8, 7])] })
    expect(s.kind).toBe('reps')
    expect(lbs(s.sets)).toEqual([185, 185, 185])
    expect(s.sets.map((x) => x.reps)).toEqual([10, 9, 8])
  })

  it('more sets than last time copy the last set', () => {
    const s = suggestNext({ ...base, sets: 4, sessions: [session(185, [8, 8])] })
    expect(s.sets.map((x) => x.reps)).toEqual([9, 9, 9, 9])
  })

  it('missing the bottom twice in a row → −10% (rounded to 5 lb)', () => {
    const s = suggestNext({ ...base, sessions: [session(200, [6, 5, 5]), session(200, [7, 5, 4])] })
    expect(s.kind).toBe('deload')
    expect(lbs(s.sets)).toEqual([180, 180, 180])
    expect(s.reason).toContain('180 lb')
  })

  it('missing once is not a deload', () => {
    expect(suggestNext({ ...base, sessions: [session(200, [6, 5, 5]), session(195, [8, 8, 8])] }).kind).toBe('reps')
  })

  it('ignores warm-ups and limited sets', () => {
    const last = [...session(95, [8], 'warmup'), ...session(185, [10, 10]), ...session(185, [3], 'limited').map((s) => ({ ...s, position: 5 }))]
    expect(suggestNext({ ...base, sessions: [last] }).kind).toBe('increase')
  })

  it('a session with only limited sets is skipped', () => {
    const s = suggestNext({ ...base, sessions: [session(185, [4], 'limited'), session(185, [10, 10, 10])] })
    expect(s.kind).toBe('increase')
  })

  it('bodyweight: +1 rep, no cap', () => {
    const s = suggestNext({ ...base, sessions: [session(0, [12, 10])] })
    expect(s.kind).toBe('bodyweight')
    expect(s.sets.map((x) => x.reps)).toEqual([13, 11, 11])
  })

  it('big jump only for barbell lower body', () => {
    expect(isBigJump({ equipment: 'barbell', primary_muscles: ['quadriceps'] })).toBe(true)
    expect(isBigJump({ equipment: 'barbell', primary_muscles: ['chest'] })).toBe(false)
    expect(isBigJump({ equipment: 'dumbbell', primary_muscles: ['quadriceps'] })).toBe(false)
  })
})
