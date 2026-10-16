import { describe, expect, it } from 'vitest'
import { mlToOz, ozToMl, suggestedGoalOz, totalOz, waterProgress } from './water'

describe('water', () => {
  it('converts oz and ml', () => {
    expect(ozToMl(8)).toBe(236.6)
    expect(Math.round(mlToOz(ozToMl(16)))).toBe(16)
  })
  it('suggests ~35 ml/kg rounded to 8 oz glasses', () => {
    expect(suggestedGoalOz(95.3)).toBe(112) // 3336 ml ≈ 112.8 oz
    expect(suggestedGoalOz(70)).toBe(80)
    expect(suggestedGoalOz(null)).toBe(96)
    expect(suggestedGoalOz(30)).toBe(64) // floor
    expect(suggestedGoalOz(250)).toBe(160) // cap
  })
  it('totals a day and caps progress', () => {
    expect(totalOz([{ amount_ml: ozToMl(8) }, { amount_ml: ozToMl(16) }])).toBe(24)
    expect(waterProgress(48, 96)).toBe(0.5)
    expect(waterProgress(120, 96)).toBe(1)
    expect(waterProgress(10, 0)).toBe(0)
  })
})
