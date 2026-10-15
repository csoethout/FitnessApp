import { useState } from 'react'
import { Stepper } from './Stepper'

/**
 * How much you ate: servings, or grams when the serving's weight is known (handy when you weigh meat).
 * Always reports servings; grams are converted with the food's grams per serving.
 */
export function AmountPicker(props: { servings: number; onChange: (servings: number) => void; gramsPerServing: number | null; startInGrams?: boolean }) {
  const { servings, onChange, gramsPerServing: grams, startInGrams } = props
  const [byGrams, setByGrams] = useState(grams !== null && !!startInGrams)
  const chip = (on: boolean) => `min-h-10 flex-1 rounded-lg text-sm ${on ? 'bg-surface-2 font-semibold' : 'text-muted'}`
  return (
    <div className="space-y-3">
      {grams !== null && (
        <div className="flex rounded-xl bg-bg p-1" role="group" aria-label="Amount in">
          <button type="button" aria-pressed={!byGrams} onClick={() => setByGrams(false)} className={chip(!byGrams)}>
            Servings
          </button>
          <button type="button" aria-pressed={byGrams} onClick={() => setByGrams(true)} className={chip(byGrams)}>
            Grams
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span>{byGrams ? 'Grams' : 'Servings'}</span>
        {byGrams && grams !== null ? (
          <Stepper
            label="grams"
            value={Math.round(servings * grams)}
            step={10}
            min={1}
            max={5000}
            format={(v) => `${v} g`}
            onChange={(v) => onChange(v / grams)}
            onTypeValue={(v) => onChange(Math.max(1, Math.round(v)) / grams)}
          />
        ) : (
          <Stepper label="servings" value={servings} step={0.25} min={0.25} max={20} format={(v) => String(Math.round(v * 100) / 100)} onChange={onChange} onTypeValue={(v) => onChange(Math.max(0.25, v))} />
        )}
      </div>
    </div>
  )
}
