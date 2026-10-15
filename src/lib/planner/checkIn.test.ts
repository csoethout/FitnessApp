import { describe, expect, it } from 'vitest'
import { checkInDue, checkInTotal, suggestCheckIn } from './checkIn'

const KG = 0.45359237
/** Daily weigh-ins for 14 days ending 2026-11-01, changing by `lbPerWeek`. */
function series(startLb: number, lbPerWeek: number) {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 19 + i))
    return { date: d.toISOString().slice(0, 10), value: (startLb + (lbPerWeek / 7) * i) * KG }
  })
}
const today = '2026-11-01'
const w = 210 * KG

describe('2-week check-in', () => {
  it('needs enough weigh-ins', () => {
    expect(suggestCheckIn(series(210, -1).slice(0, 3), w, 'recomp', today).status).toBe('not-enough-data')
  })

  it('recomp (−0.25%/wk ≈ −0.5 lb): on track within ±0.2%', () => {
    const s = suggestCheckIn(series(211, -0.6), w, 'recomp', today)
    expect(s).toMatchObject({ status: 'on-track', change: 0 })
  })

  it('recomp but gaining → −100 / −150', () => {
    expect(suggestCheckIn(series(209, 0.2), w, 'recomp', today)).toMatchObject({ status: 'adjust', change: -100 })
    expect(suggestCheckIn(series(208, 1), w, 'recomp', today)).toMatchObject({ status: 'adjust', change: -150 })
  })

  it('cut losing too fast → more food; over 1%/week → +150 regardless', () => {
    expect(suggestCheckIn(series(212, -1.9), w, 'cut', today)).toMatchObject({ status: 'adjust', change: 100 })
    const fast = suggestCheckIn(series(214, -2.5), w, 'cut', today)
    expect(fast).toMatchObject({ status: 'adjust', change: 150 })
    expect(fast.message).toContain('1%')
  })

  it('bulk gaining too slowly → +100', () => {
    expect(suggestCheckIn(series(210, -0.3), w, 'bulk', today)).toMatchObject({ status: 'adjust', change: 100 })
  })

  it('is due every 14 days, counted from the goal start or the last check-in', () => {
    expect(checkInDue([], '2026-10-16', '2026-10-29')).toBe(false)
    expect(checkInDue([], '2026-10-16', '2026-10-30')).toBe(true)
    const ci = [{ date: '2026-10-30', rate_pct_week: -0.1, change_kcal: -100 }]
    expect(checkInDue(ci, '2026-10-16', '2026-11-12')).toBe(false)
    expect(checkInDue(ci, '2026-10-16', '2026-11-13')).toBe(true)
  })

  it('only counts check-ins since the current goal started', () => {
    const ci = [
      { date: '2026-09-01', rate_pct_week: 0, change_kcal: -150 },
      { date: '2026-10-30', rate_pct_week: 0, change_kcal: -100 },
    ]
    expect(checkInTotal(ci, '2026-10-16')).toBe(-100)
  })
})
