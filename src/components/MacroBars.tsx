import type { Macros } from '@/lib/nutrition'

/**
 * Calories and protein as big meters (the two numbers that matter most for recomposition);
 * carbs and fat as small text. Calories over target turn amber; protein over target is fine.
 */
export function MacroBars({ eaten, target }: { eaten: Macros; target: Macros | null }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <Meter label="Calories" value={eaten.kcal} target={target?.kcal ?? null} unit="kcal" warnOver />
      <Meter label="Protein" value={eaten.protein_g} target={target?.protein_g ?? null} unit="g" />
      <p className="text-sm text-muted">
        Carbs <span className="text-text tabular-nums">{Math.round(eaten.carbs_g)}</span>
        {target && <> / {target.carbs_g} g</>} · Fat <span className="text-text tabular-nums">{Math.round(eaten.fat_g)}</span>
        {target && <> / {target.fat_g} g</>}
      </p>
    </section>
  )
}

function Meter(props: { label: string; value: number; target: number | null; unit: string; warnOver?: boolean }) {
  const { label, value, target, unit, warnOver } = props
  const pct = target ? Math.min(1, value / target) : 0
  const over = target !== null && value > target
  const left = target !== null ? Math.round(target - value) : null
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted">
          <span className="text-lg font-semibold text-text tabular-nums">{Math.round(value).toLocaleString()}</span>
          {target !== null && <> / {target.toLocaleString()}</>} {unit}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={Math.round(value)} aria-valuemax={target ?? undefined} aria-label={label}>
        <div className={`h-full rounded-full ${over && warnOver ? 'bg-amber-400' : 'bg-accent'}`} style={{ width: `${pct * 100}%` }} />
      </div>
      {left !== null && (
        <p className={`mt-1 text-xs ${over && warnOver ? 'text-amber-400' : 'text-muted'}`}>
          {over ? `${Math.abs(left).toLocaleString()} ${unit} over` : `${left.toLocaleString()} ${unit} left`}
        </p>
      )}
    </div>
  )
}
