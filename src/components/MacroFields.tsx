import { calculatedKcal, effectiveKcal, type MacroValues } from '@/lib/macroForm'
import { checkMacros, EXTRA_NUTRIENTS, type ExtraKey, type Extras } from '@/lib/nutrition'
import { NumberInput } from './NumberInput'

/**
 * Calories + protein / carbs / fat that must agree (4 / 4 / 9 kcal per gram).
 * Calories fill in from the macros until you type your own; then they're checked against them.
 */
export function MacroFields(props: { values: MacroValues; onChange: (v: MacroValues) => void; optionalMacros?: boolean }) {
  const { values: v, onChange, optionalMacros } = props
  const kcal = effectiveKcal(v)
  const calc = calculatedKcal(v)
  const fromMacros = calc !== null && !(v.kcalTyped && v.kcal !== null)
  const check = kcal !== null ? checkMacros(kcal, v.protein ?? 0, v.carbs ?? 0, v.fat ?? 0) : null
  const hint = optionalMacros ? 'optional' : undefined
  return (
    <div className="space-y-1">
      <NumberInput
        label="Calories"
        value={v.kcalTyped ? v.kcal : kcal}
        onChange={(k) => onChange({ ...v, kcal: k, kcalTyped: true })}
        placeholder={calc !== null ? String(calc) : undefined}
        suffix="kcal"
        required
      />
      {fromMacros && <p className="text-right text-xs text-muted">Calculated from protein, carbs and fat. Type to override.</p>}
      <NumberInput label="Protein" value={v.protein} onChange={(protein) => onChange({ ...v, protein })} suffix="g" placeholder={hint} />
      <NumberInput label="Carbs" value={v.carbs} onChange={(carbs) => onChange({ ...v, carbs })} suffix="g" placeholder={hint} />
      <NumberInput label="Fat" value={v.fat} onChange={(fat) => onChange({ ...v, fat })} suffix="g" placeholder={hint} />
      {check?.message && (
        <p role={check.status === 'over' ? 'alert' : undefined} className={`text-sm ${check.status === 'over' ? 'text-danger' : 'text-amber-400'}`}>
          {check.message}
        </p>
      )}
    </div>
  )
}

/** The optional label lines in a compact 2-column grid. */
export function ExtraFields({ values, onChange }: { values: Extras; onChange: (v: Extras) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">
        More from the label <span className="font-normal text-muted">· optional</span>
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {EXTRA_NUTRIENTS.map((n) => (
          <NumberInput
            key={n.key}
            compact
            label={n.label}
            suffix={n.unit}
            placeholder="—"
            value={values[n.key as ExtraKey] ?? null}
            onChange={(x) => onChange({ ...values, [n.key]: x })}
          />
        ))}
      </div>
    </div>
  )
}
