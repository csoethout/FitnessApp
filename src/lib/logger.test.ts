import { describe, expect, it } from 'vitest'
import { cascadeIds, currentSetIndex, formatElapsed, formatLastTime, formatWeight, prefillSets, type SetLike } from './logger'
import { toStoredKg } from './units'

const lb = (w: number) => toStoredKg(w, 'lb')
const set = (position: number, w: number, reps: number, extra: Partial<SetLike> = {}): SetLike => ({
  position, weight_kg: lb(w), reps, set_type: 'working', completed_at: '2026-10-13T10:00:00Z', ...extra,
})

describe('prefillSets', () => {
  it('repeats last session set by set, ignoring warm-ups and unfinished sets', () => {
    const last = [set(0, 45, 10, { set_type: 'warmup' }), set(1, 185, 8), set(2, 185, 7), set(3, 185, 6, { completed_at: null })]
    expect(prefillSets(3, last, 6).map((s) => [Math.round(s.weight_kg / 0.45359237), s.reps])).toEqual([
      [185, 8],
      [185, 7],
      [185, 7],
    ])
  })
  it('keeps limited (couldn\'t finish) sets as a reference', () => {
    expect(prefillSets(1, [set(0, 50, 5, { set_type: 'limited' })], 8)[0].reps).toBe(5)
  })
  it('starts at weight 0 and the bottom of the rep range with no history', () => {
    expect(prefillSets(2, [], 6)).toEqual([
      { weight_kg: 0, reps: 6 },
      { weight_kg: 0, reps: 6 },
    ])
  })
})

describe('formatting', () => {
  it('shows last time without warm-ups', () => {
    expect(formatLastTime([set(1, 185, 8), set(0, 45, 10, { set_type: 'warmup' }), set(2, 185, 7)], 'lb')).toBe('185×8 · 185×7')
    expect(formatLastTime([], 'lb')).toBeNull()
  })
  it('formats weights cleanly', () => {
    expect(formatWeight(lb(185), 'lb')).toBe('185')
    expect(formatWeight(lb(102.5), 'lb')).toBe('102.5')
    expect(formatWeight(0, 'lb')).toBe('0')
  })
  it('formats elapsed time', () => {
    expect(formatElapsed(65_000)).toBe('1:05')
    expect(formatElapsed(3_725_000)).toBe('1:02:05')
  })
  it('finds the current set', () => {
    expect(currentSetIndex([set(0, 1, 1), set(1, 1, 1, { completed_at: null })])).toBe(1)
    expect(currentSetIndex([set(0, 1, 1)])).toBe(-1)
  })
})

describe('cascadeIds', () => {
  const s = (id: string, position: number, w: number, extra: Partial<SetLike> = {}) => ({
    id, ...set(position, w, 6, { completed_at: null, ...extra }),
  })
  it('updates later pending sets that had the old value only', () => {
    const sets = [s('a', 0, 0), s('b', 1, 0), s('c', 2, 95), s('d', 3, 0), s('w', 4, 0, { set_type: 'warmup' })]
    expect(cascadeIds(sets, 'a', 'weight_kg', 0)).toEqual(['b', 'd'])
  })
  it('never touches completed sets or earlier sets', () => {
    const sets = [s('a', 0, 0), s('b', 1, 0, { completed_at: 'x' }), s('c', 2, 0)]
    expect(cascadeIds(sets, 'b', 'weight_kg', 0)).toEqual(['c'])
  })
})
