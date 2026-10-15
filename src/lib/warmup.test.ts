import { describe, expect, it } from 'vitest'
import { kgToLb, toStoredKg } from './units'
import { warmupPlan } from './warmup'

const lbs = (sets: { weight_kg: number; reps: number }[]) => sets.map((s) => [Math.round(kgToLb(s.weight_kg)), s.reps])

describe('warmupPlan (1–2 sets)', () => {
  it('gives two sets for a heavy lift: 50% × 8, 75% × 3', () => {
    expect(lbs(warmupPlan(toStoredKg(225, 'lb'), 'barbell'))).toEqual([
      [115, 8],
      [170, 3],
    ])
  })
  it('gives one set under 135 lb', () => {
    expect(lbs(warmupPlan(toStoredKg(95, 'lb'), 'barbell'))).toEqual([[50, 8]])
    expect(lbs(warmupPlan(toStoredKg(70, 'lb'), 'dumbbell'))).toEqual([[35, 8]])
  })
  it('never goes below the empty bar on barbell lifts', () => {
    expect(lbs(warmupPlan(toStoredKg(65, 'lb'), 'barbell'))).toEqual([[45, 8]])
  })
  it('skips a warm-up that would be the working weight', () => {
    expect(warmupPlan(toStoredKg(45, 'lb'), 'barbell')).toEqual([])
  })
  it('returns nothing without a working weight', () => {
    expect(warmupPlan(0, 'barbell')).toEqual([])
  })
})
