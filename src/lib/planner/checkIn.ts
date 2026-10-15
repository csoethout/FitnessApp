// Every-2-weeks calorie check-in (CLAUDE.md → Calories). Pure, unit tested.
// Compares your actual weight trend with your goal's planned rate and suggests ±100–150 kcal.
// The suggestion is only applied when you accept it; guardrails in computePlan still apply to the total.
import { weeklyRate, type DayValue } from '../body'
import { GOALS, type GoalType } from './nutrition'

export const CHECK_IN_DAYS = 14
const TOLERANCE = 0.2 // % of body weight per week counted as "on track" either side of the goal rate
const BIG_MISS = 0.4 // beyond this, adjust by 150 instead of 100
const MAX_LOSS = -1 // never lose more than 1% a week (CLAUDE.md guardrail)

export type CheckIn = { date: string; rate_pct_week: number | null; change_kcal: number }

export type CheckInSuggestion =
  | { status: 'not-enough-data'; message: string }
  | { status: 'on-track' | 'adjust'; ratePct: number; rateLb: number; targetPct: number; change: number; message: string }

const KG_PER_LB = 0.45359237
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 86_400_000)

/** Due when 2 weeks have passed since the last check-in (or since the goal started). */
export function checkInDue(checkIns: CheckIn[], goalStart: string, today: string): boolean {
  const last = checkIns.filter((c) => c.date >= goalStart).map((c) => c.date).sort().at(-1) ?? goalStart
  return daysBetween(last, today) >= CHECK_IN_DAYS
}

/** Calories added by check-ins since the goal started (a new goal starts from the plan again). */
export function checkInTotal(checkIns: CheckIn[], goalStart: string): number {
  return checkIns.filter((c) => c.date >= goalStart).reduce((s, c) => s + c.change_kcal, 0)
}

const fmtLb = (lb: number) => `${lb > 0 ? '+' : lb < 0 ? '−' : ''}${Math.abs(lb).toFixed(1)} lb/week`

export function suggestCheckIn(weighIns: DayValue[], weightKg: number, goal: GoalType, today: string): CheckInSuggestion {
  const rateKg = weeklyRate(weighIns, today, CHECK_IN_DAYS)
  if (rateKg === null) {
    return { status: 'not-enough-data', message: 'Weigh in at least 4 times over a week so the trend means something.' }
  }
  const ratePct = (rateKg / weightKg) * 100
  const rateLb = rateKg / KG_PER_LB
  const targetPct = GOALS[goal].ratePctWeek
  const targetLb = ((targetPct / 100) * weightKg) / KG_PER_LB
  const diff = ratePct - targetPct // positive = gaining faster / losing slower than planned
  const base = { ratePct, rateLb, targetPct }
  const target = `your goal is about ${fmtLb(targetLb)}`

  if (ratePct < MAX_LOSS) {
    return { ...base, status: 'adjust', change: 150, message: `You're losing ${fmtLb(rateLb)}, faster than 1% of your weight a week. Eat a bit more: +150 kcal.` }
  }
  if (Math.abs(diff) <= TOLERANCE) {
    return { ...base, status: 'on-track', change: 0, message: `You're at ${fmtLb(rateLb)}; ${target}. On track, no change needed.` }
  }
  const size = Math.abs(diff) > BIG_MISS ? 150 : 100
  const change = diff > 0 ? -size : size
  const why = diff > 0 ? (targetPct < 0 ? 'losing slower than planned' : 'gaining faster than planned') : targetPct > 0 ? 'gaining slower than planned' : 'losing faster than planned'
  return { ...base, status: 'adjust', change, message: `You're at ${fmtLb(rateLb)}; ${target}. You're ${why}: ${change > 0 ? '+' : '−'}${size} kcal.` }
}
