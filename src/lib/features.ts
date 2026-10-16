// Feature switches (data in profile.settings.features). Off = hidden from tabs and Today; data is kept.
// Workouts are the core of the app and always on.
export type FeatureKey = 'food' | 'body' | 'cardio' | 'water' | 'sleep' | 'planWeek' | 'testingTools'
export type Features = Record<FeatureKey, boolean>

export const FEATURES: { key: FeatureKey; label: string; detail: string; default: boolean }[] = [
  { key: 'food', label: 'Food & calories', detail: 'Food tab, nutrition plan, Today food card', default: true },
  { key: 'body', label: 'Body weight', detail: 'Weigh-ins on Today and Progress → Body', default: true },
  { key: 'cardio', label: 'Cardio', detail: 'Walks, runs and other cardio on Today', default: true },
  { key: 'water', label: 'Water', detail: 'Daily water goal you fill on Today', default: true },
  { key: 'sleep', label: 'Sleep', detail: 'Bedtime, wake time and how you slept', default: true },
  { key: 'planWeek', label: 'Plan my week', detail: 'Mark busy, short and away days (Train tab)', default: true },
  { key: 'testingTools', label: 'Testing tools', detail: 'Demo data and delete-all buttons (More)', default: false },
]

/** Stored switches with defaults filled in. */
export function resolveFeatures(stored: Partial<Features> | undefined): Features {
  return Object.fromEntries(FEATURES.map((f) => [f.key, stored?.[f.key] ?? f.default])) as Features
}
