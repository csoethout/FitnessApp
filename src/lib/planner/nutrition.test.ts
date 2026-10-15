import { describe, expect, it } from 'vitest'
import { ageOn, computePlan, mifflinStJeor } from './nutrition'

const owner = { sex: 'male' as const, ageYears: 23, heightCm: 195.6, weightKg: 95.25, activity: 'moderate' as const, goal: 'recomp' as const }

describe('nutrition plan', () => {
  it('computes age from the birth date', () => {
    expect(ageOn('2003-04-21', '2026-10-15')).toBe(23)
    expect(ageOn('2003-04-21', '2027-04-20')).toBe(23)
    expect(ageOn('2003-04-21', '2027-04-21')).toBe(24)
  })

  it('uses Mifflin-St Jeor', () => {
    expect(mifflinStJeor('male', 95.25, 195.6, 23)).toBeCloseTo(2065, 0)
    expect(mifflinStJeor('female', 60, 165, 30)).toBeCloseTo(1320.25, 1)
  })

  it("matches the owner's starting estimate (≈3,200 maintenance → ≈2,700 recomp, ~200 g protein)", () => {
    const p = computePlan(owner)
    expect(Math.round(p.tdee)).toBe(3201)
    expect(p.kcal).toBe(2700)
    expect(p.protein_g).toBe(200)
    expect(p.fat_g).toBe(65)
    expect(p.carbs_g).toBe(329)
    expect(p.limited).toBeNull()
  })

  it('applies nudges on top of the plan and recalculates carbs', () => {
    const p = computePlan(owner, { kcal: 100, protein_g: 10, fat_g: -5 })
    expect([p.kcal, p.protein_g, p.fat_g, p.carbs_g]).toEqual([2800, 210, 60, 355]) // carbs = (2800 − 840 − 540) ÷ 4
  })

  it('never goes below 25% under maintenance or the calorie floor', () => {
    const p = computePlan(owner, { kcal: -1000, protein_g: 0, fat_g: 0 })
    expect(p.kcal).toBe(2450) // ceil(3201 × 0.75 / 50) × 50
    expect(p.limited).toMatch(/25%/)
    const small = computePlan({ sex: 'female', ageYears: 60, heightCm: 150, weightKg: 45, activity: 'sedentary', goal: 'cut' })
    expect(small.kcal).toBe(1200)
  })

  it('keeps fat from being nudged too low', () => {
    expect(computePlan(owner, { kcal: 0, protein_g: 0, fat_g: -50 }).fat_g).toBe(50) // 0.25 g/lb floor (52.5 → 50)
  })
})
