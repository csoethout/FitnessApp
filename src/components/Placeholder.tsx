export function Placeholder({ phase, children }: { phase: number; children: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-muted">
      <p>{children}</p>
      <p className="mt-1 text-xs">Coming in Phase {phase}</p>
    </div>
  )
}
