import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { setTarget } from '@/data/food'
import { carbsFromRemainder, defaultTarget, targetProblems, type Macros } from '@/lib/nutrition'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'

/**
 * Daily targets until the Phase 5 planner sets them: calories, protein and fat; carbs fill the rest.
 * Applies from today onwards; earlier days keep the target they had.
 */
export function TargetsSheet({ today, current, onClose }: { today: string; current: Macros | null; onClose: () => void }) {
  const { store } = useData()
  const start = current ?? defaultTarget()
  const [kcal, setKcal] = useState(start.kcal)
  const [protein, setProtein] = useState(start.protein_g)
  const [fat, setFat] = useState(start.fat_g)
  const carbs = carbsFromRemainder(kcal, protein, fat)
  const problems = targetProblems({ kcal, protein_g: protein, fat_g: fat })

  return (
    <Sheet title="Daily targets" onClose={onClose}>
      <div className="space-y-4 pb-2">
        {!current && (
          <p className="text-sm text-muted">
            Starting estimate for your recomposition goal (from your stats and activity). The planner will fine-tune it in a later update.
          </p>
        )}
        <Row label="Calories" unit="kcal">
          <Stepper label="calories" value={kcal} step={50} min={1200} max={6000} onChange={setKcal} onTypeValue={(v) => setKcal(Math.round(v))} />
        </Row>
        <Row label="Protein" unit="g">
          <Stepper label="protein" value={protein} step={5} min={0} max={400} onChange={setProtein} onTypeValue={(v) => setProtein(Math.round(v))} />
        </Row>
        <Row label="Fat" unit="g">
          <Stepper label="fat" value={fat} step={5} min={0} max={300} onChange={setFat} onTypeValue={(v) => setFat(Math.round(v))} />
        </Row>
        <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
          <span>Carbs <span className="block text-xs text-muted">whatever calories are left</span></span>
          <span className="text-lg font-semibold tabular-nums">{carbs} g</span>
        </div>
        {problems.map((p) => (
          <p key={p} className="text-sm text-danger">{p}</p>
        ))}
        <button
          type="button"
          disabled={problems.length > 0}
          onClick={() => void setTarget(store, today, { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat }).then(onClose)}
          className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40"
        >
          Save
        </button>
        <p className="text-center text-xs text-muted">Applies from today. Not medical advice.</p>
      </div>
    </Sheet>
  )
}

function Row({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span>
        {label} <span className="text-xs text-muted">({unit})</span>
      </span>
      {children}
    </div>
  )
}
