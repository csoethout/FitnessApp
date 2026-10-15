import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useData } from '@/data/DataProvider'
import { createMeal, useSavedMeals } from '@/data/meals'

/** Your saved meals and recipes. Log them from Add food → Recent; edit them here. */
export function SavedMealsScreen() {
  const meals = useSavedMeals()
  const { store } = useData()
  const navigate = useNavigate()
  if (!meals) return null

  async function create() {
    const meal = await createMeal(store, 'New meal', [])
    navigate(`/food/meals/${meal.id}?new=1`)
  }

  return (
    <>
      <Link to="/food" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
        <ChevronLeft size={20} /> Food
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">Saved meals</h1>
      <p className="mb-4 text-sm text-muted">Meals you eat often, and recipes that make several servings. Add them in one tap from Add food → Recent.</p>
      {meals.length === 0 && (
        <p className="mb-4 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          Tip: log a meal once, then tap <span className="text-text">Save as meal</span> under it on the Food page.
        </p>
      )}
      <ul className="space-y-2">
        {meals.map((m) => (
          <li key={m.meal.id}>
            <Link to={`/food/meals/${m.meal.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.meal.name}</span>
                <span className="block text-sm text-muted">
                  {m.items.length} food{m.items.length === 1 ? '' : 's'}
                  {m.meal.servings_yield > 1 ? ` · makes ${m.meal.servings_yield}` : ''} · {m.per.kcal} kcal · {Math.round(m.per.protein_g)} g protein
                  {m.meal.servings_yield > 1 ? ' per serving' : ''}
                </span>
              </span>
              <ChevronRight size={20} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void create()} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted">
        <Plus size={18} /> New meal or recipe
      </button>
    </>
  )
}
