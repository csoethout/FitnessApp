import { useState } from 'react'

/**
 * Text field with the number keypad (16px so iOS doesn't zoom). Keeps exactly what you type
 * (so "12." can become "12.5"); reports a number, or null when empty.
 */
export function NumberInput(props: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  suffix?: string
  placeholder?: string
  required?: boolean
}) {
  const { label, value, onChange, suffix, placeholder, required } = props
  const [text, setText] = useState(value == null ? '' : String(value))
  return (
    <label className="flex min-h-12 items-center gap-3">
      <span className="flex-1">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={placeholder ?? '0'}
        onChange={(e) => {
          const raw = e.target.value.replace(',', '.')
          if (!/^\d*\.?\d*$/.test(raw)) return
          setText(raw)
          onChange(raw === '' || raw === '.' ? null : Number(raw))
        }}
        className="h-12 w-28 rounded-xl border border-border bg-surface-2 px-3 text-right text-base tabular-nums outline-none focus:border-accent"
        aria-label={label}
      />
      {suffix && <span className="w-8 text-sm text-muted">{suffix}</span>}
    </label>
  )
}
