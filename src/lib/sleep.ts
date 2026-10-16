// Sleep helpers (pure, unit tested). A night is stored under the morning you woke up; times are local "HH:MM".

/** "23:15" or "23:15:00" (Postgres time) → minutes after midnight. */
export function clockMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** "23:15:00" → "23:15" */
export const hhmm = (t: string) => t.slice(0, 5)

/** Minutes asleep from bedtime to wake time, crossing midnight when wake is earlier (23:30 → 06:30 = 420). */
export function sleepMinutes(bed: string, wake: string): number {
  const d = clockMinutes(wake) - clockMinutes(bed)
  return d < 0 ? d + 1440 : d
}

/** 450 → "7 h 30 min" */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** "11:15 pm" from "23:15" (US 12-hour clock). */
export function formatClock(t: string): string {
  const total = clockMinutes(t)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

export const QUALITY_LABELS = ['Awful', 'Poor', 'OK', 'Good', 'Great'] as const

/** Average minutes and quality over the nights with wake_date in [from, to]; null when there are none. */
export function sleepAverage(nights: { wake_date: string; duration_min: number; quality: number | null }[], from: string, to: string) {
  const inRange = nights.filter((n) => n.wake_date >= from && n.wake_date <= to)
  if (!inRange.length) return null
  const rated = inRange.filter((n) => n.quality !== null)
  return {
    nights: inRange.length,
    minutes: Math.round(inRange.reduce((s, n) => s + n.duration_min, 0) / inRange.length),
    quality: rated.length ? Math.round((rated.reduce((s, n) => s + n.quality!, 0) / rated.length) * 10) / 10 : null,
  }
}
