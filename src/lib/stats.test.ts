import { describe, expect, it } from 'vitest'
import { bestE1rm, e1rm, findPRs, volumeKg, workingSetCount, type StatSet } from './stats'

const s = (weight_kg: number, reps: number, set_type: StatSet['set_type'] = 'working', done = true): StatSet => ({
  weight_kg, reps, set_type, completed_at: done ? '2026-10-15T10:00:00Z' : null,
})

describe('e1rm (Epley)', () => {
  it('estimates from reps up to 10', () => {
    expect(e1rm(100, 5)).toBeCloseTo(116.667, 2)
    expect(e1rm(100, 10)).toBeCloseTo(133.333, 2)
    expect(e1rm(100, 1)).toBe(100)
  })
  it('ignores sets over 10 reps or without weight', () => {
    expect(e1rm(100, 12)).toBeNull()
    expect(e1rm(0, 5)).toBeNull()
  })
  it('only uses completed working sets', () => {
    expect(bestE1rm([s(200, 3, 'warmup'), s(150, 5, 'limited'), s(100, 5), s(300, 5, 'working', false)])).toBeCloseTo(116.667, 2)
  })
})

describe('session totals', () => {
  it('counts volume and sets without warm-ups or undone sets', () => {
    const sets = [s(20, 10, 'warmup'), s(100, 5), s(100, 4, 'limited'), s(100, 5, 'working', false)]
    expect(volumeKg(sets)).toBe(900)
    expect(workingSetCount(sets)).toBe(2)
  })
})

describe('findPRs', () => {
  it('reports a new best e1RM and heaviest weight', () => {
    const prs = findPRs([s(105, 5)], [s(100, 5), s(100, 6)])
    expect(prs.map((p) => p.kind)).toEqual(['e1rm', 'weight'])
  })
  it('can be an e1RM PR without a heavier weight (more reps)', () => {
    expect(findPRs([s(100, 8)], [s(100, 5)]).map((p) => p.kind)).toEqual(['e1rm'])
  })
  it('has no PRs the first time or when not beaten', () => {
    expect(findPRs([s(100, 5)], [])).toEqual([])
    expect(findPRs([s(100, 5)], [s(100, 5)])).toEqual([])
  })
})
