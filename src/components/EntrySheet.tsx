import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { MEAL_SLOTS } from '@/data/food'
import type { FoodLogEntry } from '@/data/types'
import { entryMacros } from '@/lib/nutrition'
import { Sheet } from './Sheet'
import { AmountPicker } from './AmountPicker'

/** Change amount (servings or grams) or meal of a logged food, or delete it. */
export function EntrySheet({ entry, onClose }: { entry: FoodLogEntry; onClose: () => void }) {
  const { store, db } = useData()
  const food = useLiveQuery(async () => (entry.food_id ? ((await db.foods.get(entry.food_id)) ?? null) : null), [db, entry.food_id])
  const [servings, setServings] = useState(entry.servings)
  const [slot, setSlot] = useState(entry.meal_slot)
  const m = entryMacros({ ...entry, servings })

  return (
    <Sheet title={entry.name} onClose={onClose}>
      <div className="space-y-4 pb-2">
        {food !== undefined && (
          <AmountPicker servings={servings} onChange={setServings} gramsPerServing={food?.serving_grams ?? null} startInGrams={food?.serving_unit === 'g'} />
        )}
        <div className="flex flex-wrap gap-2">
          {MEAL_SLOTS.map((s) => (
            <button
              key={s.slot}
              type="button"
              aria-pressed={slot === s.slot}
              onClick={() => setSlot(s.slot)}
              className={`min-h-10 rounded-full border px-3 text-sm ${slot === s.slot ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-center text-sm">
          <span className="text-lg font-semibold">{Math.round(m.kcal)}</span> kcal · {Math.round(m.protein_g)} g protein · {Math.round(m.carbs_g)} g carbs ·{' '}
          {Math.round(m.fat_g)} g fat
        </p>
        <button
          type="button"
          onClick={() => void store.update('food_log_entries', entry.id, { servings, meal_slot: slot }).then(onClose)}
          className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink"
        >
          Save
        </button>
        <button type="button" onClick={() => void store.remove('food_log_entries', entry.id).then(onClose)} className="min-h-12 w-full text-sm text-danger">
          Delete
        </button>
      </div>
    </Sheet>
  )
}
