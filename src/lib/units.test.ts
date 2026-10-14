import { describe, expect, it } from 'vitest'
import { displayWeight, toStoredKg } from './units'

describe('weight units', () => {
  it('round-trips common plate weights in lb exactly', () => {
    for (const lb of [45, 95, 135, 185, 202.5, 225, 315, 405, 210.4]) {
      expect(displayWeight(toStoredKg(lb, 'lb'), 'lb')).toBeCloseTo(lb, 6)
    }
  })

  it('stores kg unchanged when the unit is kg', () => {
    expect(toStoredKg(100, 'kg')).toBe(100)
  })

  it('converts 225 lb to about 102.06 kg', () => {
    expect(toStoredKg(225, 'lb')).toBeCloseTo(102.0583, 4)
  })
})
