import { BookmarkPlus, ChevronLeft, ChevronRight, Copy, Plus, Target, UtensilsCrossed } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AddFoodSheet } from '@/components/AddFoodSheet'
import { EntrySheet } from '@/components/EntrySheet'
import { MacroBars } from '@/components/MacroBars'
import { Sheet } from '@/components/Sheet'
import { useData } from '@/data/DataProvider'
import { copyEntries, MEAL_SLOTS } from '@/data/food'
import { useDayLog, useTargetOn } from '@/data/foodHooks'
import { saveEntriesAsMeal } from '@/data/meals'
import type { FoodLogEntry, MealSlot } from '@/data/types'
import { localDateKey } from '@/lib/body'
import { formatDay } from '@/lib/dates'
import { amountLabel } from '@/lib/foodSearch'
import { addDaysKey, entryMacros, sumExtras, sumMacros } from '@/lib/nutrition'

/** One day of eating: calories/protein vs target, meals, add food, copy yesterday. Date lives in ?d= so Back works. */
export function FoodScreen() {
  const [params, setParams] = useSearchParams()
  const [today] = useState(() => localDateKey(new Date()))
  const date = params.get('d') ?? today
  const setDate = (d: string) => setParams(d === today ? {} : { d }, { replace: true })
  const yesterday = addDaysKey(date, -1)

  const { store, db } = useData()
  const entries = useDayLog(date)
  const foods = useLiveQuery(async () => new Map((await db.foods.toArray()).map((f) => [f.id, f])), [db])
  const prevEntries = useDayLog(yesterday)
  const target = useTargetOn(date)
  const [adding, setAdding] = useState<MealSlot | null>(null)
  const [editing, setEditing] = useState<FoodLogEntry | null>(null)
  const [saving, setSaving] = useState<{ slot: MealSlot; label: string; list: FoodLogEntry[] } | null>(null)

  const totals = useMemo(() => sumMacros((entries ?? []).map(entryMacros)), [entries])
  const extras = useMemo(() => sumExtras(entries ?? []), [entries])
  if (entries === undefined || target === undefined) return null

  const label = date === today ? 'Today' : date === addDaysKey(today, -1) ? 'Yesterday' : formatDay(date + 'T12:00:00')
  const prevSlots = new Set((prevEntries ?? []).map((e) => e.meal_slot))

  return (
    <>
      <header className="mb-3 flex items-center gap-1">
        <button type="button" aria-label="Previous day" onClick={() => setDate(addDaysKey(date, -1))} className="grid size-12 place-items-center text-muted">
          <ChevronLeft />
        </button>
        <h1 className="flex-1 text-center text-2xl font-semibold">{label}</h1>
        <button
          type="button"
          aria-label="Next day"
          disabled={date >= today}
          onClick={() => setDate(addDaysKey(date, 1))}
          className="grid size-12 place-items-center text-muted disabled:opacity-30"
        >
          <ChevronRight />
        </button>
        <Link to="/food/meals" aria-label="Saved meals" className="grid size-12 place-items-center text-muted">
          <UtensilsCrossed size={22} />
        </Link>
        <Link to="/food/plan" aria-label="Your nutrition plan" className="grid size-12 place-items-center text-muted">
          <Target size={22} />
        </Link>
      </header>

      {target === null ? (
        <Link to="/food/plan" className="mb-3 block w-full rounded-2xl border border-accent bg-accent/10 p-4">
          <p className="font-semibold">Set up your nutrition plan</p>
          <p className="text-sm text-muted">Calories and protein calculated from your height, weight and goal.</p>
        </Link>
      ) : null}
      <MacroBars eaten={totals} target={target} />
      {extras.length > 0 && (
        <p className="mt-2 text-center text-xs text-muted">
          {extras.map((x) => `${x.label} ${x.unit === 'g' && x.total < 10 ? Math.round(x.total * 10) / 10 : Math.round(x.total).toLocaleString()} ${x.unit}`).join(' · ')}
        </p>
      )}

      {entries.length === 0 && (prevEntries?.length ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => void copyEntries(store, yesterday, date)}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface"
        >
          <Copy size={18} /> Copy {date === today ? "yesterday's" : 'the previous day’s'} food ({prevEntries!.length} items)
        </button>
      )}

      <div className="mt-3 space-y-3">
        {MEAL_SLOTS.map(({ slot, label: mealLabel }) => {
          const list = entries.filter((e) => e.meal_slot === slot)
          const meal = sumMacros(list.map(entryMacros))
          return (
            <section key={slot} className="rounded-2xl border border-border bg-surface">
              <div className="flex items-center gap-2 px-4 pt-3">
                <h2 className="flex-1 font-semibold">{mealLabel}</h2>
                {list.length > 0 && <span className="text-sm text-muted tabular-nums">{Math.round(meal.kcal)} kcal</span>}
              </div>
              <ul className="mt-1">
                {list.map((e) => {
                  const m = entryMacros(e)
                  return (
                    <li key={e.id}>
                      <button type="button" onClick={() => setEditing(e)} className="flex min-h-14 w-full items-center gap-3 border-t border-border px-4 py-2 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{e.name}</span>
                          <span className="block text-xs text-muted">
                            {e.food_id ? `${amountLabel(e.servings, foods?.get(e.food_id))} · ` : e.saved_meal_id ? `${amountLabel(e.servings, null)} · ` : ''}
                            {Math.round(m.protein_g)} g protein
                          </span>
                        </span>
                        <span className="text-sm tabular-nums">{Math.round(m.kcal)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="flex border-t border-border">
                <button type="button" onClick={() => setAdding(slot)} className="flex min-h-12 flex-1 items-center justify-center gap-1 text-accent">
                  <Plus size={18} /> Add
                </button>
                {list.some((e) => e.food_id) && (
                  <button
                    type="button"
                    onClick={() => setSaving({ slot, label: mealLabel, list })}
                    className="flex min-h-12 flex-1 items-center justify-center gap-1 border-l border-border text-sm text-muted"
                  >
                    <BookmarkPlus size={16} /> Save as meal
                  </button>
                )}
                {list.length === 0 && prevSlots.has(slot) && entries.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void copyEntries(store, yesterday, date, slot)}
                    className="flex min-h-12 flex-1 items-center justify-center gap-1 border-l border-border text-sm text-muted"
                  >
                    <Copy size={16} /> Same as yesterday
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted">Not medical advice.</p>

      {adding && <AddFoodSheet date={date} slot={adding} onClose={() => setAdding(null)} />}
      {editing && <EntrySheet entry={editing} onClose={() => setEditing(null)} />}
      {saving && <SaveMealSheet label={saving.label} entries={saving.list} onClose={() => setSaving(null)} />}
    </>
  )
}

/** Name a meal from the day and save it, so it's one tap under Add food → Recent next time. */
function SaveMealSheet({ label, entries, onClose }: { label: string; entries: FoodLogEntry[]; onClose: () => void }) {
  const { store } = useData()
  const [name, setName] = useState(`My ${label.toLowerCase()}`)
  const quick = entries.filter((e) => !e.food_id).length
  return (
    <Sheet title="Save as meal" onClose={onClose}>
      <div className="space-y-3 pb-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={(e) => e.target.select()}
          aria-label="Meal name"
          className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent"
        />
        <p className="text-sm text-muted">
          {entries.length - quick} food{entries.length - quick === 1 ? '' : 's'} with these amounts.
          {quick > 0 && ` Quick adds (${quick}) can't be part of a meal and are left out.`} Next time it's one tap under Add food → Recent.
        </p>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => void saveEntriesAsMeal(store, name.trim(), entries).then(onClose)}
          className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40"
        >
          Save meal
        </button>
      </div>
    </Sheet>
  )
}
