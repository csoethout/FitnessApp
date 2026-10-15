// "Plan my week" (CLAUDE.md → Plan my week). Pure, unit tested; no AI.
// Each week starts as a copy of the weekly template. You mark days normal / short (minutes) / busy / away
// (other equipment, or no gym), and the rules adapt the week:
//   1. sessions on busy days, and past sessions you didn't do, move to free rest days (most main lifts first,
//      nearest day first);
//   2. with no free day left, their main lifts are merged into another training day (one merge per day);
//   3. away days swap exercises to what's available there (no gym → bodyweight, or a run if nothing fits);
//   4. short days drop non-main lifts from the end, then trim sets (not below 2), until the session fits.
// Nothing here is stored: the plan is recomputed from the template, your day settings and what you've done.
import type { Exercise } from '@/data/types'
import { rankAlternatives } from '../swap'
import { defaultRestSeconds } from '../training'

export type DayStatus = 'normal' | 'short' | 'busy' | 'away'

export type PlanExercise = {
  exercise_id: string
  sets: number
  rep_min: number
  rep_max: number
  is_main_lift: boolean
  rest_seconds: number | null
}

export type TemplateDay = { id: string; day_of_week: number; name: string; is_rest: boolean; exercises: PlanExercise[] }

export type DayInput = {
  date: string // local YYYY-MM-DD
  status: DayStatus
  minutes: number | null // for "short"
  equipment: string[] | null // available equipment that day (null = your usual gym, anything in it)
  unavailableIds: Set<string> // "Not at this gym" at that day's gym
  past: boolean // before today: can't be planned any more
  done: boolean // a workout was logged that day
}

export type PlannedDay = {
  date: string
  status: DayStatus
  session: { name: string; templateDayId: string | null; exercises: PlanExercise[] } | null // null = rest
  minutes: number // estimated session length
  notes: string[] // plain-language explanation of every change
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const dayOfWeek = (date: string) => new Date(date + 'T12:00:00').getDay()
const dayName = (date: string) => WEEKDAY_SHORT[dayOfWeek(date)]
const daysApart = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86_400_000)

const WORK_SECONDS_PER_SET = 40
const SETUP_SECONDS_PER_EXERCISE = 60
const MIN_SETS = 2

/** Rough session length: each set ~40 s of work plus its rest, plus a minute to set up each exercise. */
export function estimateMinutes(exercises: PlanExercise[], catalog: Map<string, Exercise>): number {
  const seconds = exercises.reduce((s, e) => {
    const rest = e.rest_seconds ?? defaultRestSeconds(e.is_main_lift, catalog.get(e.exercise_id)?.mechanic ?? null)
    return s + e.sets * (WORK_SECONDS_PER_SET + rest) + SETUP_SECONDS_PER_EXERCISE
  }, 0)
  return Math.round(seconds / 60)
}

const mainCount = (s: { exercises: PlanExercise[] }) => s.exercises.filter((e) => e.is_main_lift).length
const names = (ids: PlanExercise[], catalog: Map<string, Exercise>) => ids.map((e) => catalog.get(e.exercise_id)?.name ?? 'exercise').join(', ')

export function planWeek(days: DayInput[], template: TemplateDay[], catalog: Exercise[]): PlannedDay[] {
  const byId = new Map(catalog.map((e) => [e.id, e]))
  const byDow = new Map(template.map((t) => [t.day_of_week, t]))
  const out: PlannedDay[] = days.map((d) => {
    const t = byDow.get(dayOfWeek(d.date))
    const session = t && !t.is_rest ? { name: t.name, templateDayId: t.id, exercises: t.exercises.map((e) => ({ ...e })) } : null
    return { date: d.date, status: d.status, session, minutes: 0, notes: [] }
  })
  const input = new Map(days.map((d) => [d.date, d]))
  const canTrain = (d: DayInput) => !d.past && d.status !== 'busy'

  // 1. Sessions that won't happen where they are: busy (future) or missed (past, nothing logged).
  type Moving = { from: string; why: 'busy' | 'missed'; session: NonNullable<PlannedDay['session']>; order: number }
  const moving: Moving[] = []
  out.forEach((p, i) => {
    const d = input.get(p.date)!
    if (!p.session) return
    if (d.past && !d.done) {
      moving.push({ from: p.date, why: 'missed', session: p.session, order: i })
      p.session = null
    } else if (!d.past && d.status === 'busy') {
      moving.push({ from: p.date, why: 'busy', session: p.session, order: i })
      p.session = null
    }
  })
  moving.sort((a, b) => mainCount(b.session) - mainCount(a.session) || a.order - b.order)
  const mergedInto = new Set<string>()

  for (const m of moving) {
    const origin = out.find((p) => p.date === m.from)!
    const label = m.why === 'busy' ? 'Busy' : 'Missed'
    const free = out.filter((p) => !p.session && canTrain(input.get(p.date)!) && p.date !== m.from)
    // Nearest free day; on a tie, the later one (so the session comes after the day it was planned).
    free.sort((a, b) => Math.abs(daysApart(m.from, a.date)) - Math.abs(daysApart(m.from, b.date)) || b.date.localeCompare(a.date))
    const slot = free[0]
    if (slot) {
      slot.session = { ...m.session, exercises: m.session.exercises.map((e) => ({ ...e })) }
      slot.notes.push(`${m.session.name} moved here from ${dayName(m.from)} (${m.why}).`)
      origin.notes.push(`${label}: ${m.session.name} moved to ${dayName(slot.date)}.`)
      continue
    }
    // 2. No free day: merge its main lifts (or its first two exercises) into the shortest training day ahead.
    // At most one merge per day, so no day turns into a marathon.
    const hosts = out.filter((p) => p.session && canTrain(input.get(p.date)!) && !input.get(p.date)!.done && !mergedInto.has(p.date))
    hosts.sort((a, b) => a.session!.exercises.length - b.session!.exercises.length || a.date.localeCompare(b.date))
    const host = hosts[0]
    const extra = (m.session.exercises.some((e) => e.is_main_lift) ? m.session.exercises.filter((e) => e.is_main_lift) : m.session.exercises.slice(0, 2)).filter(
      (e) => !host?.session!.exercises.some((h) => h.exercise_id === e.exercise_id),
    )
    if (host && extra.length) {
      host.session!.exercises.push(...extra.map((e) => ({ ...e })))
      mergedInto.add(host.date)
      host.notes.push(`Added ${names(extra, byId)} from ${m.session.name} (${dayName(m.from)}, ${m.why}).`)
      origin.notes.push(`${label}: no free day left, so the main lifts of ${m.session.name} were added to ${dayName(host.date)}.`)
    } else {
      origin.notes.push(`${label}: no free day left for ${m.session.name} this week.`)
    }
  }

  for (const p of out) {
    const d = input.get(p.date)!
    if (!p.session || d.past) continue

    // 3. Away: swap what isn't there for the best alternative; drop what has none.
    if (d.status === 'away' || d.equipment) {
      const swapped: string[] = []
      const dropped: string[] = []
      const kept: PlanExercise[] = []
      for (const e of p.session.exercises) {
        const ex = byId.get(e.exercise_id)
        const doable = ex && !d.unavailableIds.has(ex.id) && (!d.equipment || ex.equipment === null || d.equipment.includes(ex.equipment))
        if (doable) {
          kept.push(e)
          continue
        }
        const taken = new Set([...kept.map((k) => k.exercise_id), ...p.session.exercises.map((k) => k.exercise_id)])
        const alt = ex ? rankAlternatives(ex, catalog, { equipment: d.equipment, unavailableIds: d.unavailableIds, excludeIds: taken })[0] : undefined
        if (alt) {
          kept.push({ ...e, exercise_id: alt.id })
          swapped.push(`${alt.name} for ${ex!.name}`)
        } else dropped.push(ex?.name ?? 'exercise')
      }
      p.session.exercises = kept
      if (swapped.length) p.notes.push(`Swapped for the equipment there: ${swapped.join('; ')}.`)
      if (dropped.length) p.notes.push(`Nothing similar there for ${dropped.join(', ')}, so it's left out.`)
      if (!kept.length) {
        p.session = { name: 'Run or walk', templateDayId: p.session.templateDayId, exercises: [] }
        p.notes.push('No equipment for this session: go for a run or a long walk instead.')
      }
    }

    // 4. Short on time: drop non-main lifts from the end, then trim sets, until it fits.
    if (d.status === 'short' && d.minutes && p.session.exercises.length) {
      const ex = p.session.exercises
      const dropped: PlanExercise[] = []
      while (estimateMinutes(ex, byId) > d.minutes) {
        const i = ex.map((e) => e.is_main_lift).lastIndexOf(false)
        if (i < 0 || ex.length <= 1) break
        dropped.unshift(...ex.splice(i, 1))
      }
      let trimmed = false
      while (estimateMinutes(ex, byId) > d.minutes) {
        const most = ex.reduce((m, e) => (e.sets > m.sets ? e : m), ex[0])
        if (most.sets <= MIN_SETS) break
        most.sets -= 1
        trimmed = true
      }
      if (dropped.length) p.notes.push(`Short day (${d.minutes} min): left out ${names(dropped, byId)}.`)
      if (trimmed) p.notes.push(`Fewer sets to fit ${d.minutes} min.`)
      if (estimateMinutes(ex, byId) > d.minutes) p.notes.push(`Still about ${estimateMinutes(ex, byId)} min: do what you can.`)
    }
  }

  for (const p of out) p.minutes = p.session ? estimateMinutes(p.session.exercises, byId) : 0
  return out
}
