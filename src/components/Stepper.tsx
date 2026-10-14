import { useState } from 'react'

type Props = {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  label?: string
  format?: (value: number) => string
  /** Optional: tapping the number opens a keypad to type a value. */
  onTypeValue?: (value: number) => void
}

/** Big − value + control. 48px buttons so it works with sweaty thumbs. */
export function Stepper({ value, onChange, step = 1, min = 0, max = Infinity, label, format = String, onTypeValue }: Props) {
  const [typing, setTyping] = useState(false)
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
      {typing ? (
        <input
          autoFocus
          type="text"
          inputMode="decimal"
          defaultValue={value || ''}
          aria-label={`Type ${label ?? 'value'}`}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => {
            const v = Number(e.target.value.replace(',', '.'))
            if (e.target.value.trim() !== '' && Number.isFinite(v)) onTypeValue?.(Math.min(max, Math.max(min, v)))
            setTyping(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-12 w-16 rounded-lg border border-accent bg-surface-2 text-center text-lg font-semibold outline-none"
        />
      ) : onTypeValue ? (
        <button
          type="button"
          onClick={() => setTyping(true)}
          aria-label={`${label ?? 'value'} ${format(value)}, tap to type`}
          className="h-12 min-w-16 rounded-lg text-center text-lg font-semibold tabular-nums underline decoration-border decoration-dotted underline-offset-4"
        >
          {format(value)}
        </button>
      ) : (
        <span className="min-w-12 text-center text-lg font-semibold tabular-nums" aria-label={label}>
          {format(value)}
        </span>
      )}
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
