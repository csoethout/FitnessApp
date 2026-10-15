import { describe, expect, it } from 'vitest'
import { kgToLb } from './units'
import { warmupPlan } from './warmup'
import { toStoredKg } from './units'

const lbs = (sets: { weight_kg: number; reps: number }[]) => sets.map((s) => [Math.round(kgToLb(s.weight_kg)), s.reps])

describe('warmupPlan', () => {
  it('ramps a 225 lb barbell squat: bar, 50%, 70%, 85%', () => {
    expect(lbs(warmupPlan(toStoredKg(225, 'lb'), 'barbell'))).toEqual([
      [45, 10],
      [115, 5],
      [160, 3],
      [190, 1],
    ])
  })
  it('skips steps too close to the previous one (95 lb: 50 lb is barely above the bar)', () => {
    expect(lbs(warmupPlan(toStoredKg(95, 'lb'), 'barbell'))).toEqual([
      [45, 10],
      [65, 3],
      [80, 1],
    ])
  })
  it('uses 40% instead of a bar for dumbbells and machines', () => {
    expect(lbs(warmupPlan(toStoredKg(70, 'lb'), 'dumbbell'))).toEqual([
      [30, 10],
      [50, 3],
      [60, 1],
    ])
  })
  it('returns nothing without a working weight', () => {
    expect(warmupPlan(0, 'barbell')).toEqual([])
  })
})
