import { describe, expect, it } from 'vitest'
import type { Exercise } from '@/data/types'
import { estimateMinutes, planWeek, type DayInput, type PlanExercise, type TemplateDay } from './week'

const ex = (id: string, equipment: string, primary: string, mechanic: 'compound' | 'isolation' = 'compound'): Exercise => ({
  id, owner_id: null, source: 'free-exercise-db', source_id: id, name: id, primary_muscles: [primary], secondary_muscles: [], equipment,
  mechanic, force: 'push', level: 'beginner', category: 'strength', images: [], created_at: '', updated_at: '', deleted_at: null,
})
const catalog = [
  ex('Bench', 'barbell', 'chest'), ex('Pushup', 'body only', 'chest'), ex('Fly', 'cable', 'chest', 'isolation'),
  ex('Squat', 'barbell', 'quadriceps'), ex('Lunge', 'body only', 'quadriceps'), ex('LegCurl', 'machine', 'hamstrings', 'isolation'),
  ex('Row', 'barbell', 'middle back'), ex('Curl', 'dumbbell', 'biceps', 'isolation'),
]
const pe = (id: string, main = false, sets = 3): PlanExercise => ({ exercise_id: id, sets, rep_min: 6, rep_max: 10, is_main_lift: main, rest_seconds: null })
// Sun 2026-10-18 … Sat 2026-10-24
const template: TemplateDay[] = [
  { id: 'sun', day_of_week: 0, name: 'Back', is_rest: false, exercises: [pe('Row', true), pe('Curl')] },
  { id: 'mon', day_of_week: 1, name: 'Legs', is_rest: false, exercises: [pe('Squat', true), pe('LegCurl')] },
  { id: 'tue', day_of_week: 2, name: 'Chest', is_rest: false, exercises: [pe('Bench', true), pe('Fly')] },
  { id: 'wed', day_of_week: 3, name: 'Arms', is_rest: false, exercises: [pe('Curl')] },
  { id: 'thu', day_of_week: 4, name: 'Rest', is_rest: true, exercises: [] },
  { id: 'fri', day_of_week: 5, name: 'Rest', is_rest: true, exercises: [] },
  { id: 'sat', day_of_week: 6, name: 'Full', is_rest: false, exercises: [pe('Squat', true), pe('Bench', true)] },
]
const dates = ['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']
const week = (over: Partial<Record<string, Partial<DayInput>>> = {}): DayInput[] =>
  dates.map((date) => ({ date, status: 'normal', minutes: null, equipment: null, unavailableIds: new Set(), past: false, done: false, ...over[date] }))
const sessionOn = (plan: ReturnType<typeof planWeek>, date: string) => plan.find((p) => p.date === date)!.session

describe('plan my week', () => {
  it('a normal week is the template', () => {
    const plan = planWeek(week(), template, catalog)
    expect(plan.map((p) => p.session?.name ?? '-')).toEqual(['Back', 'Legs', 'Chest', 'Arms', '-', '-', 'Full'])
    expect(plan.every((p) => p.notes.length === 0)).toBe(true)
  })

  it('a busy day moves its session to the nearest free day', () => {
    const plan = planWeek(week({ '2026-10-21': { status: 'busy' } }), template, catalog)
    expect(sessionOn(plan, '2026-10-21')).toBeNull()
    expect(sessionOn(plan, '2026-10-22')?.name).toBe('Arms')
    expect(plan[3].notes[0]).toContain('moved to Thu')
    expect(plan[4].notes[0]).toContain('from Wed')
  })

  it('sessions with the most main lifts get the free days first; the rest merge their main lifts', () => {
    // Thu and Fri busy too → only rest days are gone; Mon+Tue busy need 2 free days but Thu/Fri are busy.
    const plan = planWeek(week({ '2026-10-19': { status: 'busy' }, '2026-10-20': { status: 'busy' }, '2026-10-22': { status: 'busy' } }), template, catalog)
    // Only Fri is free: Legs (1 main) vs Chest (1 main) → tie → earlier in the week (Legs) wins.
    expect(sessionOn(plan, '2026-10-23')?.name).toBe('Legs')
    // Chest's main lift (Bench) merges into the shortest training day ahead (Arms, Wed).
    expect(sessionOn(plan, '2026-10-21')?.exercises.map((e) => e.exercise_id)).toEqual(['Curl', 'Bench'])
    expect(plan[2].notes[0]).toContain('added to Wed')
  })

  it('a missed past session moves to a free day ahead; done days stay', () => {
    const plan = planWeek(
      week({ '2026-10-18': { past: true, done: true }, '2026-10-19': { past: true, done: false }, '2026-10-20': { past: true, done: true } }),
      template, catalog,
    )
    expect(sessionOn(plan, '2026-10-18')?.name).toBe('Back')
    expect(sessionOn(plan, '2026-10-19')).toBeNull()
    expect(sessionOn(plan, '2026-10-22')?.name).toBe('Legs')
    expect(plan[1].notes[0]).toBe('Missed: Legs moved to Thu.')
  })

  it('away with no gym: bodyweight swaps; nothing left → run', () => {
    const plan = planWeek(week({ '2026-10-20': { status: 'away', equipment: ['body only'] }, '2026-10-21': { status: 'away', equipment: ['body only'] } }), template, catalog)
    expect(sessionOn(plan, '2026-10-20')?.exercises.map((e) => e.exercise_id)).toEqual(['Pushup'])
    expect(plan[2].notes.join(' ')).toContain('Pushup for Bench')
    expect(plan[2].notes.join(' ')).toContain('Fly') // no bodyweight chest isolation besides Pushup (already used)
    expect(sessionOn(plan, '2026-10-21')?.name).toBe('Run or walk')
  })

  it('short days drop non-main lifts, then trim sets (not below 2)', () => {
    const full = estimateMinutes(template[1].exercises, new Map(catalog.map((e) => [e.id, e])))
    const plan = planWeek(week({ '2026-10-19': { status: 'short', minutes: 12 } }), template, catalog)
    const legs = sessionOn(plan, '2026-10-19')!
    expect(full).toBeGreaterThan(12)
    expect(legs.exercises.map((e) => [e.exercise_id, e.sets])).toEqual([['Squat', 3]])
    const tighter = planWeek(week({ '2026-10-19': { status: 'short', minutes: 8 } }), template, catalog)
    expect(sessionOn(tighter, '2026-10-19')!.exercises[0].sets).toBe(2)
    expect(tighter[1].notes.join(' ')).toContain('LegCurl')
  })

  it('merges at most once into each day', () => {
    // Sun–Wed missed (past), it's Thu: Thu and Fri are free rest days, Sat is training.
    const plan = planWeek(
      week({ '2026-10-18': { past: true }, '2026-10-19': { past: true }, '2026-10-20': { past: true }, '2026-10-21': { past: true } }),
      template, catalog,
    )
    // Back → Thu, Legs → Fri (free days); Chest and Arms merge into two different days.
    expect(plan.map((p) => p.notes.filter((n) => n.startsWith('Added')).length).every((n) => n <= 1)).toBe(true)
    expect(plan.flatMap((p) => p.notes).filter((n) => n.startsWith('Added')).length).toBe(2)
  })

  it('never plans into the past', () => {
    const plan = planWeek(week({ '2026-10-22': { past: true }, '2026-10-23': { past: true }, '2026-10-24': { status: 'busy' } }), template, catalog)
    // Sat busy, Thu/Fri are past → nowhere free; main lifts merge into a training day that isn't past (none left → dropped note)
    expect(sessionOn(plan, '2026-10-22')).toBeNull()
    expect(plan[6].notes.length).toBe(1)
  })
})
