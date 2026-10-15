import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { createCustomFood, logFood, logQuickAdd, MEAL_SLOTS, recentFoods, type RecentItem } from '@/data/food'
import type { Food, MealSlot } from '@/data/types'
import { NumberInput } from './NumberInput'
import { Stepper } from './Stepper'

type Tab = 'recent' | 'label' | 'quick'

/**
 * Add food to a meal. Opens on Recent (you eat the same things a lot), then Label (type the
 * nutrition panel) and Quick add (just calories). Search, Scan and Saved meals arrive in steps 4.3–4.5.
 */
export function AddFoodSheet(props: { date: string; slot: MealSlot; onClose: () => void }) {
  const { date, onClose } = props
  const [slot, setSlot] = useState<MealSlot>(props.slot)
  const [tab, setTab] = useState<Tab>('recent')
  const [picked, setPicked] = useState<RecentItem | null>(null)

  const tabs: { key: Tab; label: string }[] = [
    { key: 'recent', label: 'Recent' },
    { key: 'label', label: 'Nutrition label' },
    { key: 'quick', label: 'Quick add' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-4 pt-3">
        <h2 className="flex-1 text-xl font-semibold">Add food</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-12 place-items-center">
          <X />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-2" aria-label="Meal">
        {MEAL_SLOTS.map((m) => (
          <button
            key={m.slot}
            type="button"
            aria-pressed={slot === m.slot}
            onClick={() => setSlot(m.slot)}
            className={`min-h-10 shrink-0 rounded-full border px-3 text-sm ${slot === m.slot ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div role="tablist" className="mx-4 grid grid-cols-3 rounded-xl bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 rounded-lg text-sm ${tab === t.key ? 'bg-surface-2 font-semibold' : 'text-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {tab === 'recent' && <RecentTab date={date} onPick={setPicked} onEmpty={() => setTab('label')} />}
        {tab === 'label' && <LabelTab date={date} slot={slot} onDone={onClose} />}
        {tab === 'quick' && <QuickTab date={date} slot={slot} onDone={onClose} />}
      </div>
      {picked && <ServingsSheet item={picked} date={date} slot={slot} onCancel={() => setPicked(null)} onDone={onClose} />}
    </div>
  )
}

function RecentTab({ date, onPick, onEmpty }: { date: string; onPick: (r: RecentItem) => void; onEmpty: () => void }) {
  const { db } = useData()
  const items = useLiveQuery(() => recentFoods(db, date), [db, date])
  if (!items) return null
  if (!items.length) {
    return (
      <div className="py-10 text-center text-muted">
        <p>Foods you log will show up here for one-tap adding.</p>
        <button type="button" onClick={onEmpty} className="mt-4 min-h-12 rounded-xl border border-border px-4 text-text">
          Add from a nutrition label
        </button>
      </div>
    )
  }
  return (
    <ul>
      {items.map((r) => (
        <li key={r.key}>
          <button type="button" onClick={() => onPick(r)} className="flex min-h-14 w-full items-center gap-3 border-b border-border py-2 text-left">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{r.name}</span>
              <span className="block text-xs text-muted">
                {r.food ? `${r.food.serving_amount} ${r.food.serving_unit}` : 'Quick add'} · {Math.round(r.kcal)} kcal · {Math.round(r.protein_g)} g protein
              </span>
            </span>
            <span className="text-xs text-muted">×{r.count}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Pick how many servings, see the totals, add. */
function ServingsSheet(props: { item: RecentItem; date: string; slot: MealSlot; onCancel: () => void; onDone: () => void }) {
  const { item, date, slot, onCancel, onDone } = props
  const { store } = useData()
  const [servings, setServings] = useState(item.lastServings || 1)
  const t = (v: number) => Math.round(v * servings)

  async function add() {
    if (item.food) await logFood(store, date, slot, item.food, servings)
    else await logQuickAdd(store, date, slot, { name: item.name, kcal: item.kcal * servings, protein_g: item.protein_g * servings, carbs_g: item.carbs_g * servings, fat_g: item.fat_g * servings })
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end bg-black/60" onClick={onCancel}>
      <div role="dialog" aria-label={item.name} onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl border-t border-border bg-surface px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <h3 className="text-lg font-semibold">{item.name}</h3>
        <p className="text-sm text-muted">{item.food ? `1 serving = ${item.food.serving_amount} ${item.food.serving_unit}` : 'Quick add'}</p>
        {item.food && (
          <div className="mt-4 flex items-center justify-between">
            <span>Servings</span>
            <Stepper label="servings" value={servings} step={0.25} min={0.25} max={20} format={(v) => String(v)} onChange={setServings} onTypeValue={(v) => setServings(Math.max(0.25, v))} />
          </div>
        )}
        <p className="mt-4 text-center text-sm">
          <span className="text-lg font-semibold">{t(item.kcal)}</span> kcal · <span className="font-semibold">{t(item.protein_g)}</span> g protein ·{' '}
          {t(item.carbs_g)} g carbs · {t(item.fat_g)} g fat
        </p>
        <button type="button" onClick={() => void add()} className="mt-4 min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink">
          Add
        </button>
      </div>
    </div>
  )
}

/** Type in a nutrition label. Saves it as your own food (shows in Recent next time), then logs it. */
function LabelTab({ date, slot, onDone }: { date: string; slot: MealSlot; onDone: () => void }) {
  const { store } = useData()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [servingAmount, setServingAmount] = useState<number | null>(1)
  const [servingUnit, setServingUnit] = useState('serving')
  const [grams, setGrams] = useState<number | null>(null)
  const [kcal, setKcal] = useState<number | null>(null)
  const [protein, setProtein] = useState<number | null>(null)
  const [carbs, setCarbs] = useState<number | null>(null)
  const [fat, setFat] = useState<number | null>(null)
  const [servings, setServings] = useState(1)
  const ok = name.trim() !== '' && kcal !== null && (servingAmount ?? 0) > 0

  async function save() {
    const food: Food = await createCustomFood(store, {
      name: name.trim(), brand: brand.trim() || null, serving_amount: servingAmount ?? 1, serving_unit: servingUnit.trim() || 'serving',
      serving_grams: grams, kcal: kcal ?? 0, protein_g: protein ?? 0, carbs_g: carbs ?? 0, fat_g: fat ?? 0, fiber_g: null, barcode: null,
    })
    await logFood(store, date, slot, food, servings)
    onDone()
  }

  const text = 'h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent'
  return (
    <div className="space-y-3">
      <input className={text} placeholder="Food name *" value={name} onChange={(e) => setName(e.target.value)} aria-label="Food name" />
      <input className={text} placeholder="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Brand" />
      <p className="pt-2 text-sm font-semibold">Per serving, as on the label</p>
      <div className="flex items-center gap-2">
        <span className="flex-1">Serving size</span>
        <input
          type="text"
          inputMode="decimal"
          aria-label="Serving amount"
          defaultValue="1"
          onChange={(e) => setServingAmount(Number(e.target.value.replace(',', '.')) || null)}
          className="h-12 w-16 rounded-xl border border-border bg-surface-2 px-2 text-right text-base outline-none focus:border-accent"
        />
        <input aria-label="Serving unit" value={servingUnit} onChange={(e) => setServingUnit(e.target.value)} className="h-12 w-28 rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent" />
      </div>
      <NumberInput label="Grams per serving" value={grams} onChange={setGrams} suffix="g" placeholder="optional" />
      <NumberInput label="Calories" value={kcal} onChange={setKcal} suffix="kcal" required />
      <NumberInput label="Protein" value={protein} onChange={setProtein} suffix="g" />
      <NumberInput label="Carbs" value={carbs} onChange={setCarbs} suffix="g" />
      <NumberInput label="Fat" value={fat} onChange={setFat} suffix="g" />
      <div className="flex items-center justify-between pt-2">
        <span>Servings eaten</span>
        <Stepper label="servings" value={servings} step={0.25} min={0.25} max={20} format={(v) => String(v)} onChange={setServings} onTypeValue={(v) => setServings(Math.max(0.25, v))} />
      </div>
      <button type="button" disabled={!ok} onClick={() => void save()} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40">
        Save food &amp; add
      </button>
      <p className="text-center text-xs text-muted">Saved to your foods, so next time it's one tap under Recent.</p>
    </div>
  )
}

/** Just the numbers, no food saved. */
function QuickTab({ date, slot, onDone }: { date: string; slot: MealSlot; onDone: () => void }) {
  const { store } = useData()
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState<number | null>(null)
  const [protein, setProtein] = useState<number | null>(null)
  const [carbs, setCarbs] = useState<number | null>(null)
  const [fat, setFat] = useState<number | null>(null)

  async function save() {
    await logQuickAdd(store, date, slot, { name: name.trim() || 'Quick add', kcal: kcal ?? 0, protein_g: protein ?? 0, carbs_g: carbs ?? 0, fat_g: fat ?? 0 })
    onDone()
  }
  return (
    <div className="space-y-3">
      <input
        className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent"
        placeholder="What was it? (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Name"
      />
      <NumberInput label="Calories" value={kcal} onChange={setKcal} suffix="kcal" required />
      <NumberInput label="Protein" value={protein} onChange={setProtein} suffix="g" placeholder="optional" />
      <NumberInput label="Carbs" value={carbs} onChange={setCarbs} suffix="g" placeholder="optional" />
      <NumberInput label="Fat" value={fat} onChange={setFat} suffix="g" placeholder="optional" />
      <button type="button" disabled={kcal === null} onClick={() => void save()} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40">
        Add
      </button>
    </div>
  )
}
