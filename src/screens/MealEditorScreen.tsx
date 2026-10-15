import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { AddFoodSheet } from '@/components/AddFoodSheet'
import { AmountPicker } from '@/components/AmountPicker'
import { useConfirm } from '@/components/ConfirmProvider'
import { Sheet } from '@/components/Sheet'
import { Stepper } from '@/components/Stepper'
import { localDateKey } from '@/lib/body'
import { amountLabel } from '@/lib/foodSearch'
import { useData } from '@/data/DataProvider'
import { addMealItem, deleteMeal, useSavedMeal, type MealItemView } from '@/data/meals'

/** Edit a saved meal or recipe: name, how many servings it makes, its foods and amounts. */
export function MealEditorScreen() {
  const { mealId } = useParams()
  const [params] = useSearchParams()
  const m = useSavedMeal(mealId)
  const { store } = useData()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<MealItemView | null>(null)
  const [today] = useState(() => localDateKey(new Date()))

  if (m === undefined) return null
  if (m === null) return <p className="text-muted">Meal not found.</p>
  const { meal, items, per } = m
  const isRecipe = meal.servings_yield > 1

  async function remove() {
    const ok = await confirm({ title: `Delete “${meal.name}”?`, message: 'Days you already logged keep their entries.', confirmLabel: 'Delete', danger: true })
    if (!ok) return
    await deleteMeal(store, m!)
    navigate('/food/meals', { replace: true })
  }

  return (
    <>
      <Link to="/food/meals" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
        <ChevronLeft size={20} /> Saved meals
      </Link>
      <input
        key={meal.updated_at}
        defaultValue={meal.name}
        autoFocus={params.has('new')}
        onFocus={(e) => params.has('new') && e.target.select()}
        aria-label="Meal name"
        onBlur={(e) => {
          const name = e.target.value.trim()
          if (name && name !== meal.name) void store.update('saved_meals', meal.id, { name })
        }}
        className="mb-3 w-full rounded-lg bg-transparent text-2xl font-semibold outline-none focus:bg-surface-2"
      />

      <div className="mb-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-xs text-muted">{isRecipe ? 'Per serving' : 'Whole meal'}</p>
        <p className="text-2xl font-semibold tabular-nums">
          {per.kcal} <span className="text-sm font-normal text-muted">kcal</span> · {Math.round(per.protein_g)}{' '}
          <span className="text-sm font-normal text-muted">g protein</span>
        </p>
        <p className="text-sm text-muted">
          {Math.round(per.carbs_g)} g carbs · {Math.round(per.fat_g)} g fat
          {isRecipe && ` · whole batch ${Math.round(per.kcal * meal.servings_yield)} kcal`}
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <span>
          Servings it makes
          <span className="block text-xs text-muted">{isRecipe ? 'A recipe: logging 1 serving takes 1/' + meal.servings_yield + ' of the batch' : 'More than 1 for a batch recipe'}</span>
        </span>
        <Stepper
          label="servings it makes"
          value={meal.servings_yield}
          min={1}
          max={50}
          format={String}
          onChange={(v) => void store.update('saved_meals', meal.id, { servings_yield: v })}
        />
      </div>

      <ul className="rounded-2xl border border-border bg-surface">
        {items.map((x) => (
          <li key={x.item.id} className="border-b border-border last:border-b-0">
            <button type="button" onClick={() => setEditing(x)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{x.food.brand ? `${x.food.name} (${x.food.brand})` : x.food.name}</span>
                <span className="block text-xs text-muted">
                  {amountLabel(x.item.servings, x.food)} · {Math.round(x.food.protein_g * x.item.servings)} g protein
                </span>
              </span>
              <span className="text-sm tabular-nums">{Math.round(x.food.kcal * x.item.servings)}</span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No foods yet.</li>}
      </ul>
      <button type="button" onClick={() => setAdding(true)} className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted">
        <Plus size={18} /> Add food
      </button>

      <button type="button" onClick={() => void remove()} className="mt-8 flex min-h-12 w-full items-center justify-center gap-2 text-sm text-danger">
        <Trash2 size={16} /> Delete meal
      </button>

      {adding && <AddFoodSheet date={today} onClose={() => setAdding(false)} pickOnly={{ title: `Add to ${meal.name}`, onAdd: (food, servings) => addMealItem(store, m, food, servings) }} />}
      {editing && <ItemSheet x={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

/** Change a food's amount in the meal, or take it out. */
function ItemSheet({ x, onClose }: { x: MealItemView; onClose: () => void }) {
  const { store } = useData()
  const [servings, setServings] = useState(x.item.servings)
  const t = (v: number) => Math.round(v * servings)
  return (
    <Sheet title={x.food.name} onClose={onClose}>
      <div className="space-y-4 pb-2">
        <AmountPicker servings={servings} onChange={setServings} gramsPerServing={x.food.serving_grams} startInGrams={x.food.serving_unit === 'g'} />
        <p className="text-center text-sm">
          <span className="text-lg font-semibold">{t(x.food.kcal)}</span> kcal · {t(x.food.protein_g)} g protein · {t(x.food.carbs_g)} g carbs · {t(x.food.fat_g)} g fat
        </p>
        <button
          type="button"
          onClick={() => void store.update('saved_meal_items', x.item.id, { servings }).then(onClose)}
          className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink"
        >
          Save
        </button>
        <button type="button" onClick={() => void store.remove('saved_meal_items', x.item.id).then(onClose)} className="min-h-12 w-full text-sm text-danger">
          Remove from meal
        </button>
      </div>
    </Sheet>
  )
}
