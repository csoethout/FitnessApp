import { GlassWater, Plus } from 'lucide-react'
import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { logWater, saveWaterSettings, useWaterDay } from '@/data/water'
import { localDateKey } from '@/lib/body'
import { mlToOz, totalOz, waterProgress } from '@/lib/water'
import { Sheet } from './Sheet'
import { Stepper } from './Stepper'

/** Today: a bar you fill with one tap per glass or bottle. Tap the numbers to change the goal or bottle size. */
export function WaterCard() {
  const { store } = useData()
  const [today] = useState(() => localDateKey(new Date()))
  const day = useWaterDay(today)
  const [settingsOpen, setSettingsOpen] = useState(false)
  if (!day) return null
  const oz = totalOz(day.entries)
  const pct = waterProgress(oz, day.goalOz)
  const last = day.entries.at(-1)
  const add = (amount: number) => void logWater(store, today, amount)
  const btn = 'flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-border text-sm font-medium'

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" aria-label="Water">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <GlassWater size={18} className="text-accent" /> Water
        </h2>
        <button type="button" onClick={() => setSettingsOpen(true)} className="-my-3 min-h-12 text-sm text-muted" aria-label="Water goal and bottle size">
          <span className="font-semibold text-text tabular-nums">{oz}</span> / {day.goalOz} oz
        </button>
      </div>
      <div
        className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label="Water today"
        aria-valuemin={0}
        aria-valuemax={day.goalOz}
        aria-valuenow={oz}
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{oz >= day.goalOz ? 'Goal reached 💧' : `${day.goalOz - oz} oz to go`}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => add(8)} className={btn}>
          <Plus size={16} /> 8 oz
        </button>
        <button type="button" onClick={() => add(16)} className={btn}>
          <Plus size={16} /> 16 oz
        </button>
        <button type="button" onClick={() => add(day.bottleOz)} className={`${btn} border-accent text-accent`}>
          <Plus size={16} /> Bottle ({day.bottleOz})
        </button>
      </div>
      {last && (
        <button type="button" onClick={() => void store.remove('water_entries', last.id)} className="mt-1 min-h-11 w-full text-sm text-muted">
          Undo last ({Math.round(mlToOz(last.amount_ml))} oz)
        </button>
      )}
      {settingsOpen && <WaterSettingsSheet goalOz={day.goalOz} suggestedOz={day.suggestedOz} customGoal={day.customGoal} bottleOz={day.bottleOz} onClose={() => setSettingsOpen(false)} />}
    </section>
  )
}

function WaterSettingsSheet(props: { goalOz: number; suggestedOz: number; customGoal: boolean; bottleOz: number; onClose: () => void }) {
  const { store } = useData()
  const [goal, setGoal] = useState(props.goalOz)
  const [bottle, setBottle] = useState(props.bottleOz)
  async function save(useSuggested = false) {
    await saveWaterSettings(store, { waterGoalOz: useSuggested || goal === props.suggestedOz ? null : goal, waterBottleOz: bottle })
    props.onClose()
  }
  return (
    <Sheet title="Water" onClose={props.onClose}>
      <div className="space-y-4 pb-2">
        <div className="flex items-center justify-between">
          <span>
            Daily goal
            <span className="block text-xs text-muted">Suggested for your weight: {props.suggestedOz} oz</span>
          </span>
          <Stepper label="daily goal" value={goal} step={8} min={16} max={256} format={(v) => `${v} oz`} onChange={setGoal} onTypeValue={(v) => setGoal(Math.round(v))} />
        </div>
        <div className="flex items-center justify-between">
          <span>My bottle</span>
          <Stepper label="bottle size" value={bottle} step={2} min={4} max={128} format={(v) => `${v} oz`} onChange={setBottle} onTypeValue={(v) => setBottle(Math.round(v))} />
        </div>
        <p className="text-xs text-muted">About 35 ml per kg of body weight (~½ oz per lb). Drink more on hot days and long sessions. Not medical advice.</p>
        <button type="button" onClick={() => void save()} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink">
          Save
        </button>
        {props.customGoal && (
          <button type="button" onClick={() => void save(true)} className="min-h-12 w-full text-sm text-muted">
            Use the suggested goal ({props.suggestedOz} oz)
          </button>
        )}
      </div>
    </Sheet>
  )
}
