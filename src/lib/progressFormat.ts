import { formatWeight } from './logger'
import type { Metric } from './progress'
import type { WeightUnit } from './units'

export function metricLabel(m: Metric): string {
  return m === 'e1rm' ? 'Est. 1-rep max' : m === 'weight' ? 'Heaviest' : 'Most reps'
}

export function formatMetric(v: number, m: Metric, unit: WeightUnit = 'lb'): string {
  return m === 'reps' ? `${v} reps` : `${formatWeight(v, unit)} ${unit}`
}
