import { useEffect, useState } from 'react'

const parse = (raw: string) => (raw === '' || raw === '.' ? null : Number(raw))

/**
 * Text field with the number keypad (16px so iOS doesn't zoom). Keeps exactly what you type
 * (so "12." can become "12.5"); reports a number, or null when empty. Follows `value` when it
 * changes from outside (e.g. calories calculated from macros).
 */
export function NumberInput(props: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  suffix?: string
  placeholder?: string
  required?: boolean
  compact?: boolean // label above, narrow field (for the optional nutrient grid)
}) {
  const { label, value, onChange, suffix, placeholder, required, compact } = props
  const [text, setText] = useState(value == null ? '' : String(value))
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    if (parse(text) !== value) setText(value == null ? '' : String(value))
    // Only react to outside changes of `value`, not to typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const input = (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder ?? '0'}
      onChange={(e) => {
        const raw = e.target.value.replace(',', '.')
        if (!/^\d*\.?\d*$/.test(raw)) return
        setText(raw)
        onChange(parse(raw))
      }}
      className={`h-12 rounded-xl border border-border bg-surface-2 px-3 text-right text-base tabular-nums outline-none focus:border-accent ${compact ? 'w-full' : 'w-28'}`}
      aria-label={label}
    />
  )
  if (compact) {
    return (
      <label className="block">
        <span className="mb-1 block text-xs text-muted">
          {label} {suffix && `(${suffix})`}
        </span>
        {input}
      </label>
    )
  }
  return (
    <label className="flex min-h-12 items-center gap-3">
      <span className="flex-1">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {input}
      {suffix && <span className="w-8 text-sm text-muted">{suffix}</span>}
    </label>
  )
}
