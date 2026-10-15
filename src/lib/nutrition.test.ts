import { describe, expect, it } from 'vitest'
import { addDaysKey, carbsFromRemainder, defaultTarget, entryMacros, sumMacros, targetOn, targetProblems } from './nutrition'

describe('nutrition', () => {
  it('scales an entry by servings and sums a day', () => {
    const e = { servings: 1.5, kcal_per_serving: 165, protein_g_per_serving: 31, carbs_g_per_serving: 0, fat_g_per_serving: 3.6 }
    expect(entryMacros(e)).toEqual({ kcal: 247.5, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 })
    expect(sumMacros([entryMacros(e), entryMacros({ ...e, servings: 0.5 })]).kcal).toBeCloseTo(330)
  })

  it('fills carbs from the remaining calories', () => {
    expect(carbsFromRemainder(2700, 200, 65)).toBe(329) // (2700 - 800 - 585) / 4
    expect(carbsFromRemainder(1500, 250, 80)).toBe(0) // never negative
    expect(defaultTarget()).toEqual({ kcal: 2700, protein_g: 200, fat_g: 65, carbs_g: 329 })
  })

  it('enforces the guardrails', () => {
    expect(targetProblems({ kcal: 2700, protein_g: 200, fat_g: 65 })).toEqual([])
    expect(targetProblems({ kcal: 1200, protein_g: 150, fat_g: 50 })[0]).toMatch(/1500/)
    expect(targetProblems({ kcal: 2000, protein_g: 200, fat_g: 30 }).join()).toMatch(/fat/i)
    expect(targetProblems({ kcal: 1600, protein_g: 300, fat_g: 60 }).join()).toMatch(/more than your calories/)
  })

  it('picks the target in effect on a date', () => {
    const ts = [
      { effective_from: '2026-10-01', deleted_at: null, kcal: 2700 },
      { effective_from: '2026-10-15', deleted_at: null, kcal: 2600 },
    ]
    expect(targetOn(ts, '2026-10-14')?.kcal).toBe(2700)
    expect(targetOn(ts, '2026-10-20')?.kcal).toBe(2600)
    expect(targetOn(ts, '2026-09-01')).toBeNull()
  })

  it('shifts dates across month ends', () => {
    expect(addDaysKey('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28')
  })
})
