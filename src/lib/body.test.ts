import { describe, expect, it } from 'vitest'
import { localDateKey, rollingAverage, weeklyRate, type DayValue } from './body'

const days = (start: string, values: number[]): DayValue[] =>
  values.map((value, i) => {
    const [y, m, d] = start.split('-').map(Number)
    return { date: localDateKey(new Date(y, m - 1, d + i)), value }
  })

describe('body trend', () => {
  it('uses the local calendar date', () => {
    expect(localDateKey(new Date(2026, 9, 5, 7, 30))).toBe('2026-10-05')
  })

  it('averages the last 7 days, tolerating gaps', () => {
    const pts = days('2026-10-01', [210, 212, 208, 210, 210, 210, 210, 203])
    const avg = rollingAverage(pts)
    expect(avg[0].value).toBe(210) // only one reading so far
    expect(avg[6].value).toBeCloseTo(210, 5)
    expect(avg[7].value).toBeCloseTo((212 + 208 + 210 * 4 + 203) / 7, 5) // Oct 1 dropped out of the window
    const gappy = rollingAverage([{ date: '2026-10-01', value: 200 }, { date: '2026-10-10', value: 210 }])
    expect(gappy[1].value).toBe(210) // Oct 1 is more than 7 days back
  })

  it('reports the weekly rate from a fitted line, but only with enough data', () => {
    // Losing 0.1 lb a day = -0.7 lb/week, with daily noise
    const pts = days('2026-10-01', [210, 209.6, 210.1, 209.5, 209.4, 209.6, 209.1, 209.0, 209.3, 208.7, 208.9, 208.5, 208.6, 208.7])
    expect(weeklyRate(pts, '2026-10-14')).toBeCloseTo(-0.75, 1)
    expect(weeklyRate(pts.slice(0, 3), '2026-10-03')).toBeNull() // too few readings
    expect(weeklyRate(days('2026-10-01', [210, 209, 208, 207]), '2026-10-04')).toBeNull() // under a week
  })
})
