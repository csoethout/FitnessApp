type Props = {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  label?: string
  format?: (value: number) => string
}

/** Big − value + control. 48px buttons so it works with sweaty thumbs. */
export function Stepper({ value, onChange, step = 1, min = 0, max = Infinity, label, format = String }: Props) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)))
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Decrease ${label ?? ''}`}
        onClick={() => set(value - step)}
        disabled={value <= min}
        className="size-12 rounded-xl bg-surface-2 text-2xl leading-none disabled:opacity-30"
      >
        −
      </button>
      <span className="min-w-12 text-center text-lg font-semibold tabular-nums" aria-label={label}>
        {format(value)}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label ?? ''}`}
        onClick={() => set(value + step)}
        disabled={value >= max}
        className="size-12 rounded-xl bg-surface-2 text-2xl leading-none disabled:opacity-30"
      >
        +
      </button>
    </div>
  )
}
