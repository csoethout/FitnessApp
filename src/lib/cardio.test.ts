import { describe, expect, it } from 'vitest'
import { cardioTotals, describeCardio, kmToMi, miToKm } from './cardio'

describe('cardio', () => {
  it('converts miles and km', () => {
    expect(miToKm(1)).toBe(1.609)
    expect(kmToMi(miToKm(3.1))).toBeCloseTo(3.1, 2)
  })
  it('describes an entry', () => {
    expect(describeCardio({ activity: 'walk', duration_min: 25, distance_km: miToKm(1.2) })).toBe('Walk · 25 min · 1.2 mi')
    expect(describeCardio({ activity: 'bike', duration_min: 40, distance_km: null })).toBe('Bike · 40 min')
  })
  it('adds up a week', () => {
    expect(cardioTotals([{ duration_min: 20, distance_km: miToKm(1) }, { duration_min: 30.4, distance_km: null }])).toEqual({ sessions: 2, minutes: 50, miles: 1 })
  })
})
