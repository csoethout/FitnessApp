import { describe, expect, it } from 'vitest'
import { formatClock, formatDuration, sleepAverage, sleepMinutes } from './sleep'

describe('sleep', () => {
  it('measures across midnight', () => {
    expect(sleepMinutes('23:30', '06:30')).toBe(420)
    expect(sleepMinutes('01:00', '08:15')).toBe(435)
    expect(sleepMinutes('22:00:00', '22:00:00')).toBe(0)
  })
  it('formats', () => {
    expect(formatDuration(450)).toBe('7 h 30 min')
    expect(formatDuration(480)).toBe('8 h')
    expect(formatDuration(25)).toBe('25 min')
    expect(formatClock('23:05')).toBe('11:05 pm')
    expect(formatClock('00:30:00')).toBe('12:30 am')
    expect(formatClock('12:00')).toBe('12:00 pm')
  })
  it('averages a date range, quality only over rated nights', () => {
    const nights = [
      { wake_date: '2026-10-10', duration_min: 400, quality: 3 },
      { wake_date: '2026-10-11', duration_min: 480, quality: null },
      { wake_date: '2026-10-12', duration_min: 440, quality: 4 },
      { wake_date: '2026-10-01', duration_min: 100, quality: 1 },
    ]
    expect(sleepAverage(nights, '2026-10-06', '2026-10-12')).toEqual({ nights: 3, minutes: 440, quality: 3.5 })
    expect(sleepAverage(nights, '2026-11-01', '2026-11-07')).toBeNull()
  })
})
