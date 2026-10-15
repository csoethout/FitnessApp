import { describe, expect, it } from 'vitest'
import {
  chooseMetric, prEvents, recentChange, sessionPoints, startOfWeek, weeklyMuscleSets, weeklyVolume, type ExerciseSession,
} from './progress'
import type { StatSet } from './stats'

const set = (w: number, reps: number, set_type: StatSet['set_type'] = 'working'): StatSet => ({
  weight_kg: w, reps, set_type, completed_at: 'x',
})
const session = (exerciseId: string, startedAt: string, sets: StatSet[], primaryMuscles = ['quadriceps']): ExerciseSession => ({
  exerciseId, workoutId: startedAt, startedAt, primaryMuscles, sets,
})

describe('weeks', () => {
  it('starts weeks on Sunday (local time)', () => {
    const d = startOfWeek(new Date(2026, 9, 15, 18)) // Thu Oct 15 2026
    expect([d.getDay(), d.getDate()]).toEqual([0, 11])
  })

  it('counts working sets per muscle group for the week, warm-ups excluded', () => {
    const wk = new Date(2026, 9, 11)
    const sessions = [
      session('squat', new Date(2026, 9, 12, 9).toISOString(), [set(20, 10, 'warmup'), set(100, 5), set(100, 5)]),
      session('bench', new Date(2026, 9, 13, 9).toISOString(), [set(80, 5), set(80, 5), set(80, 5)], ['chest']),
      session('row', new Date(2026, 9, 14, 9).toISOString(), [set(60, 8)], ['middle back', 'lats']), // one group, counted once
      session('old', new Date(2026, 9, 4, 9).toISOString(), [set(100, 5)], ['chest']), // previous week
    ]
    const r = Object.fromEntries(weeklyMuscleSets(sessions, wk).map((g) => [g.label, g.sets]))
    expect(r).toMatchObject({ Legs: 2, Chest: 3, Back: 1, Shoulders: 0 })
  })

  it('totals volume per week, oldest first, 8 weeks ending this week', () => {
    const now = new Date(2026, 9, 15)
    const v = weeklyVolume([session('a', new Date(2026, 9, 12).toISOString(), [set(100, 5)]), session('a', new Date(2026, 9, 5).toISOString(), [set(100, 4)])], now)
    expect(v.length).toBe(8)
    expect(v.at(-1)?.volumeKg).toBe(500)
    expect(v.at(-2)?.volumeKg).toBe(400)
  })
})

describe('per-exercise trend', () => {
  const s = [
    session('squat', '2026-09-01T10:00:00Z', [set(100, 5)]),
    session('squat', '2026-09-10T10:00:00Z', [set(102.5, 5)]),
    session('squat', '2026-10-14T10:00:00Z', [set(110, 5)]),
  ]
  it('builds one point per session and picks e1RM when available', () => {
    const pts = sessionPoints(s)
    expect(pts.length).toBe(3)
    expect(chooseMetric(pts)).toBe('e1rm')
  })
  it('falls back to heaviest weight for high-rep work and to reps for bodyweight', () => {
    expect(chooseMetric(sessionPoints([session('curl', 'a', [set(20, 12)])]))).toBe('weight')
    expect(chooseMetric(sessionPoints([session('legraise', 'a', [set(0, 15)])]))).toBe('reps')
  })
  it('measures change over the last 4 weeks', () => {
    const c = recentChange(sessionPoints(s), 'weight', new Date('2026-10-15T00:00:00Z'))
    expect(c).toEqual({ delta: 7.5, since: 'period' }) // vs Sep 10, the last session before the 28-day window
  })
  it('compares with the first session when history is shorter than 4 weeks', () => {
    const now = new Date('2026-09-20T00:00:00Z')
    expect(recentChange(sessionPoints(s.slice(0, 2)), 'weight', now)).toEqual({ delta: 2.5, since: 'start' })
    expect(recentChange(sessionPoints(s.slice(0, 1)), 'weight', now)).toBeNull() // one session: nothing to compare
  })
})

describe('prEvents', () => {
  it('lists PRs newest first, none for the first session', () => {
    const ev = prEvents([
      session('squat', '2026-09-01T10:00:00Z', [set(100, 5)]),
      session('squat', '2026-09-08T10:00:00Z', [set(100, 4)]),
      session('squat', '2026-09-15T10:00:00Z', [set(105, 5)]),
    ])
    expect(ev.map((e) => [e.date.slice(5, 10), e.kind])).toEqual([
      ['09-15', 'e1rm'],
      ['09-15', 'weight'],
    ])
  })
})
