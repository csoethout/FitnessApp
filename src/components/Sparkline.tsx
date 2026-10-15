/**
 * Tiny trend line (no axes): 2px line in the chart color, end dot with a surface ring.
 * Decorative next to the number it summarises, so it's hidden from screen readers.
 */
export function Sparkline({ values, width = 64, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span style={{ width }} aria-hidden />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = 5
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2)
  const y = (v: number) => (max === min ? height / 2 : pad + (1 - (v - min) / (max - min)) * (height - pad * 2))
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const lastX = x(values.length - 1)
  const lastY = y(values[values.length - 1])
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke="var(--color-chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={4} fill="var(--color-chart)" stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  )
}
