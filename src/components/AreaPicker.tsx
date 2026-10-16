import { AREAS, type AreaChoice, type Focus } from '@/lib/planner/split'

const CHOICES: { key: AreaChoice; label: string }[] = [
  { key: 'skip', label: 'Skip' },
  { key: 'normal', label: 'Normal' },
  { key: 'focus', label: 'Focus' },
]

/** One row per body area with Skip / Normal / Focus. */
export function AreaPicker({ value, onChange }: { value: Focus; onChange: (f: Focus) => void }) {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {AREAS.map((area) => {
        const current = value[area] ?? 'normal'
        return (
          <div key={area} className="flex items-center gap-3 px-4 py-2">
            <span className={`flex-1 ${current === 'skip' ? 'text-muted line-through' : ''}`}>{area}</span>
            <div className="flex gap-1" role="group" aria-label={area}>
              {CHOICES.map((c) => {
                const on = current === c.key
                const tone = c.key === 'skip' ? 'border-danger/60 bg-danger/10 text-danger' : 'border-accent bg-accent/15 text-accent'
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ ...value, [area]: c.key })}
                    className={`min-h-11 min-w-16 rounded-lg border px-2 text-sm ${on ? tone : 'border-border text-muted'}`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
