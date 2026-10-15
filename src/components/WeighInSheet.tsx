import { useState } from 'react'
import { deleteWeighIn, saveWeighIn } from '@/data/body'
import { useData } from '@/data/DataProvider'
import type { BodyMeasurement } from '@/data/types'
import { formatDay } from '@/lib/dates'
import { kgToLb, lbToKg } from '@/lib/units'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'

const round1 = (v: number) => Math.round(v * 10) / 10

/**
 * Weigh-in for one day: weight, body fat %, muscle mass — all visible, the last two optional.
 * Starts from today's entry, or the most recent values, so a normal morning is "nudge and save".
 */
export function WeighInSheet(props: { date: string; existing?: BodyMeasurement; history: BodyMeasurement[]; onClose: () => void }) {
  const { date, existing, history, onClose } = props
  const { store } = useData()
  // New entry: each field starts from its own most recent reading (body fat may not be measured every day).
  const latest = <K extends 'weight_kg' | 'body_fat_pct' | 'muscle_mass_kg'>(k: K) =>
    [...history].reverse().find((m) => m.measured_on <= date && m[k] !== null)?.[k] ?? null
  const pick = <K extends 'weight_kg' | 'body_fat_pct' | 'muscle_mass_kg'>(k: K) => (existing ? existing[k] : latest(k))
  const toLb = (kg: number | null) => (kg == null ? null : round1(kgToLb(kg)))
  const [weight, setWeight] = useState<number | null>(toLb(pick('weight_kg')))
  const [bodyFat, setBodyFat] = useState<number | null>(pick('body_fat_pct'))
  const [muscle, setMuscle] = useState<number | null>(toLb(pick('muscle_mass_kg')))
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    await saveWeighIn(store, date, {
      weight_kg: weight == null ? null : Math.round(lbToKg(weight) * 10_000) / 10_000,
      body_fat_pct: bodyFat,
      muscle_mass_kg: muscle == null ? null : Math.round(lbToKg(muscle) * 1000) / 1000,
    })
    onClose()
  }

  return (
    <Sheet title={existing ? `Weigh-in · ${formatDay(date + 'T12:00:00')}` : 'Weigh in'} onClose={onClose}>
      <div className="space-y-4 pb-2">
        <Field label="Weight" unit="lb" value={weight} onChange={setWeight} step={0.2} min={50} max={800} />
        <Field label="Body fat" unit="%" optional value={bodyFat} onChange={setBodyFat} step={0.1} min={2} max={70} />
        <Field label="Muscle mass" unit="lb" optional value={muscle} onChange={setMuscle} step={0.2} min={10} max={400} />
        <p className="text-xs text-muted">Weigh at the same time each morning, after the bathroom and before eating, for the steadiest trend.</p>
        <button
          type="button"
          disabled={busy || (weight == null && bodyFat == null && muscle == null)}
          onClick={() => void save()}
          className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-50"
        >
          Save
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => void deleteWeighIn(store, existing.id).then(onClose)}
            className="min-h-12 w-full text-sm text-danger"
          >
            Delete this weigh-in
          </button>
        )}
      </div>
    </Sheet>
  )
}

/** A number with − / + and tap-to-type. Optional fields start empty with an "Add" button. */
function Field(props: {
  label: string
  unit: string
  value: number | null
  onChange: (v: number | null) => void
  step: number
  min: number
  max: number
  optional?: boolean
}) {
  const { label, unit, value, onChange, step, min, max, optional } = props
  const [typing, setTyping] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3">
      <span>
        {label}
        {optional && <span className="block text-xs text-muted">optional</span>}
      </span>
      {value == null && !typing ? (
        <button type="button" onClick={() => setTyping(true)} className="min-h-12 rounded-xl border border-dashed border-border px-4 text-muted">
          + Add {unit}
        </button>
      ) : typing ? (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          defaultValue={value ?? ''}
          aria-label={`${label} in ${unit}`}
          onBlur={(e) => {
            const raw = e.target.value.trim().replace(',', '.')
            const v = Number(raw)
            if (raw === '') onChange(optional ? null : value)
            else if (Number.isFinite(v)) onChange(round1(Math.min(max, Math.max(min, v))))
            setTyping(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-12 w-28 rounded-lg border border-accent bg-surface-2 text-center text-lg font-semibold outline-none"
        />
      ) : (
        <div className="flex items-center gap-1">
          <Stepper
            label={label.toLowerCase()}
            value={value!}
            step={step}
            min={min}
            max={max}
            format={(v) => v.toFixed(1)}
            onChange={(v) => onChange(round1(v))}
            onTypeValue={(v) => onChange(round1(v))}
          />
          <span className="w-6 text-sm text-muted">{unit}</span>
        </div>
      )}
    </div>
  )
}
