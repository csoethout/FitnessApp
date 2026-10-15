// Cardio helpers (pure, unit tested). Distance is stored in km and shown in miles (owner is in the US).
import type { CardioActivity } from '@/data/types'

export const KM_PER_MI = 1.609344
export const miToKm = (mi: number) => Math.round(mi * KM_PER_MI * 1000) / 1000
export const kmToMi = (km: number) => km / KM_PER_MI

export const ACTIVITIES: { key: CardioActivity; label: string }[] = [
  { key: 'walk', label: 'Walk' },
  { key: 'run', label: 'Run' },
  { key: 'bike', label: 'Bike' },
  { key: 'row', label: 'Row' },
  { key: 'swim', label: 'Swim' },
  { key: 'other', label: 'Other' },
]
export const activityLabel = (a: CardioActivity) => ACTIVITIES.find((x) => x.key === a)?.label ?? 'Cardio'

/** "Walk · 25 min · 1.2 mi" */
export function describeCardio(e: { activity: CardioActivity; duration_min: number; distance_km: number | null }): string {
  const parts = [activityLabel(e.activity), `${Math.round(e.duration_min)} min`]
  if (e.distance_km) parts.push(`${kmToMi(e.distance_km).toFixed(1)} mi`)
  return parts.join(' · ')
}

/** Totals for a list of entries: sessions, minutes, miles. */
export function cardioTotals(entries: { duration_min: number; distance_km: number | null }[]) {
  return {
    sessions: entries.length,
    minutes: Math.round(entries.reduce((s, e) => s + e.duration_min, 0)),
    miles: Math.round(kmToMi(entries.reduce((s, e) => s + (e.distance_km ?? 0), 0)) * 10) / 10,
  }
}
