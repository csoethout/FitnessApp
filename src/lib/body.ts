// Body-weight trend maths (pure functions, unit tested).

export type DayValue = { date: string; value: number } // date = local YYYY-MM-DD

/** Local calendar date as YYYY-MM-DD (not UTC: a 7 am weigh-in belongs to today, not "yesterday in London"). */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAY = 86_400_000
const toTime = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/**
 * 7-day average for each day that has a reading: the mean of all readings in that day and the 6 days before.
 * Smooths out the 2–4 lb daily swings from water and salt. Missing days are fine.
 */
export function rollingAverage(points: DayValue[], days = 7): DayValue[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((p) => {
    const t = toTime(p.date)
    const window = sorted.filter((q) => toTime(q.date) <= t && toTime(q.date) > t - days * DAY)
    return { date: p.date, value: window.reduce((s, q) => s + q.value, 0) / window.length }
  })
}

/**
 * Average change per week over the last `days` days, from a least-squares line through the readings.
 * null with fewer than 4 readings or less than a week of span (too noisy to say anything).
 */
export function weeklyRate(points: DayValue[], today: string, days = 14): number | null {
  const end = toTime(today)
  const recent = points.filter((p) => toTime(p.date) <= end && toTime(p.date) > end - days * DAY)
  if (recent.length < 4) return null
  const xs = recent.map((p) => toTime(p.date) / DAY)
  if (Math.max(...xs) - Math.min(...xs) < 7) return null
  const ys = recent.map((p) => p.value)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0)
  return den === 0 ? null : (num / den) * 7
}
