import { useLiveQuery } from 'dexie-react-hooks'
import { ScanBarcode, Search, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useData } from '@/data/DataProvider'
import { createCustomFood, logFood, logQuickAdd, lookupBarcode, MEAL_SLOTS, recentFoods, saveFoundFood, type RecentItem } from '@/data/food'
import { searchUsda, usingDemoKey } from '@/data/foodApi'
import { matchesQuery, servingLabel, type FoundFood } from '@/lib/foodSearch'
import type { Food, MealSlot } from '@/data/types'
import { effectiveKcal, EMPTY_MACROS, macrosValid, type MacroValues } from '@/lib/macroForm'
import { EXTRA_NUTRIENTS, foodCol, type Extras } from '@/lib/nutrition'
import { AmountPicker } from './AmountPicker'
import { ExtraFields, MacroFields } from './MacroFields'
import { NumberInput } from './NumberInput'
import { Stepper } from './Stepper'

type Tab = 'recent' | 'search' | 'label' | 'quick'
type Scan = { step: 'camera' } | { step: 'looking' | 'notfound' | 'offline'; code: string }

// The scanner and its ~1 MB reader load only when you tap Scan.
const BarcodeScanner = lazy(() => import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })))

/**
 * Add food to a meal. Opens on Recent (you eat the same things a lot), then Search (your foods + USDA), Label (type
 * the nutrition panel) and Quick add (just the numbers). Scan (header button) looks a barcode up in your foods, USDA,
 * then Open Food Facts. Calories and macros must agree (4/4/9 kcal per g). Saved meals arrive in step 4.5.
 */
export function AddFoodSheet(props: { date: string; slot: MealSlot; onClose: () => void }) {
  const { date, onClose } = props
  const [slot, setSlot] = useState<MealSlot>(props.slot)
  const [tab, setTab] = useState<Tab>('recent')
  const [picked, setPicked] = useState<Portion | null>(null)
  const [scan, setScan] = useState<Scan | null>(null)
  const [labelBarcode, setLabelBarcode] = useState<string | null>(null)
  const scanCtrl = useRef<AbortController | null>(null)
  useEffect(() => () => scanCtrl.current?.abort(), [])
  const { store } = useData()

  const tabs: { key: Tab; label: string }[] = [
    { key: 'recent', label: 'Recent' },
    { key: 'search', label: 'Search' },
    { key: 'label', label: 'Label' },
    { key: 'quick', label: 'Quick add' },
  ]

  function pickRecent(r: RecentItem) {
    setPicked({
      title: r.name, kcal: r.kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, food: r.food, startServings: r.lastServings || 1,
      add: async (servings) => {
        if (r.food) await logFood(store, date, slot, r.food, servings)
        else await logQuickAdd(store, date, slot, { name: r.name, kcal: r.kcal * servings, protein_g: r.protein_g * servings, carbs_g: r.carbs_g * servings, fat_g: r.fat_g * servings })
      },
    })
  }

  function pickFound(f: FoundFood) {
    setPicked({
      title: f.brand ? `${f.name} (${f.brand})` : f.name, kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, food: f, startServings: 1,
      add: async (servings) => logFood(store, date, slot, await saveFoundFood(store, f), servings).then(() => undefined),
    })
  }

  function pickMine(food: Food) {
    setPicked({
      title: food.brand ? `${food.name} (${food.brand})` : food.name, kcal: food.kcal, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g,
      food, startServings: 1, add: (servings) => logFood(store, date, slot, food, servings),
    })
  }

  async function lookup(code: string) {
    scanCtrl.current?.abort()
    const c = new AbortController()
    scanCtrl.current = c
    setScan({ step: 'looking', code })
    try {
      const r = await lookupBarcode(store, code, c.signal)
      if (c.signal.aborted) return
      if (r.kind === 'mine') pickMine(r.food)
      if (r.kind === 'found') pickFound(r.found)
      setScan(r.kind === 'mine' || r.kind === 'found' ? null : { step: r.kind, code })
    } catch {
      // cancelled
    }
  }

  function typeFromLabel(code: string) {
    setLabelBarcode(code)
    setTab('label')
    setScan(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2 px-4 pt-3">
        <h2 className="flex-1 text-xl font-semibold">Add food</h2>
        <button type="button" onClick={() => setScan({ step: 'camera' })} className="flex min-h-12 items-center gap-2 rounded-xl border border-border px-3">
          <ScanBarcode size={20} /> Scan
        </button>
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
      <div role="tablist" className="mx-4 grid grid-cols-4 rounded-xl bg-surface p-1">
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
        {tab === 'recent' && <RecentTab date={date} onPick={pickRecent} onEmpty={() => setTab('search')} />}
        {tab === 'search' && <SearchTab date={date} onPick={pickFound} onPickMine={pickRecent} onLabel={() => setTab('label')} />}
        {tab === 'label' && <LabelTab key={labelBarcode ?? ''} date={date} slot={slot} barcode={labelBarcode} onDone={onClose} />}
        {tab === 'quick' && <QuickTab date={date} slot={slot} onDone={onClose} />}
      </div>
      {picked && <PortionSheet portion={picked} onCancel={() => setPicked(null)} onDone={onClose} />}
      {scan?.step === 'camera' && (
        <Suspense fallback={<div className="fixed inset-0 z-[60] bg-black" />}>
          <BarcodeScanner onCode={(code) => void lookup(code)} onClose={() => setScan(null)} />
        </Suspense>
      )}
      {scan && scan.step !== 'camera' && (
        <ScanResult
          scan={scan}
          onCancel={() => {
            scanCtrl.current?.abort()
            setScan(null)
          }}
          onRetry={() => void lookup(scan.code)}
          onRescan={() => setScan({ step: 'camera' })}
          onLabel={() => typeFromLabel(scan.code)}
        />
      )}
    </div>
  )
}

/** While a scanned code is looked up, or when it wasn't found. */
function ScanResult(props: { scan: Exclude<Scan, { step: 'camera' }>; onCancel: () => void; onRetry: () => void; onRescan: () => void; onLabel: () => void }) {
  const { scan, onCancel, onRetry, onRescan, onLabel } = props
  const btn = 'min-h-12 w-full rounded-xl border border-border'
  return (
    <div className="fixed inset-0 z-[55] flex items-end bg-black/60" onClick={onCancel}>
      <div role="dialog" aria-label="Barcode" onClick={(e) => e.stopPropagation()} className="w-full space-y-3 rounded-t-3xl border-t border-border bg-surface px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-muted tabular-nums">Barcode {scan.code}</p>
        {scan.step === 'looking' && <p className="py-4 text-center">Looking it up…</p>}
        {scan.step === 'notfound' && (
          <>
            <p>Not in USDA or Open Food Facts. Type it from the label once; next time this barcode finds it instantly.</p>
            <button type="button" onClick={onLabel} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink">
              Type it from the label
            </button>
            <button type="button" onClick={onRescan} className={btn}>
              Scan again
            </button>
          </>
        )}
        {scan.step === 'offline' && (
          <>
            <p>Couldn’t reach the food databases. Check your connection, or type it from the label.</p>
            <button type="button" onClick={onRetry} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink">
              Try again
            </button>
            <button type="button" onClick={onLabel} className={btn}>
              Type it from the label
            </button>
          </>
        )}
        <button type="button" onClick={onCancel} className="min-h-12 w-full text-sm text-muted">
          Cancel
        </button>
      </div>
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
          Search foods
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
                {r.food ? servingLabel(r.food) : 'Quick add'} · {Math.round(r.kcal)} kcal · {Math.round(r.protein_g)} g protein
              </span>
            </span>
            <span className="text-xs text-muted">×{r.count}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

type Portion = {
  title: string
  kcal: number // per serving
  protein_g: number
  carbs_g: number
  fat_g: number
  food: { serving_amount: number; serving_unit: string; serving_grams: number | null } | null // null = quick add
  startServings: number
  add: (servings: number) => Promise<unknown>
}

/** Pick how much (servings, or grams when the serving's weight is known), see the totals, add. */
function PortionSheet({ portion: p, onCancel, onDone }: { portion: Portion; onCancel: () => void; onDone: () => void }) {
  const [servings, setServings] = useState(p.startServings)
  const [busy, setBusy] = useState(false)
  const t = (v: number) => Math.round(v * servings)

  async function add() {
    setBusy(true)
    try {
      await p.add(servings)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end bg-black/60" onClick={onCancel}>
      <div role="dialog" aria-label={p.title} onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl border-t border-border bg-surface px-4 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <h3 className="text-lg font-semibold">{p.title}</h3>
        <p className="text-sm text-muted">{p.food ? `1 serving = ${servingLabel(p.food)}` : 'Quick add'}</p>
        {p.food && (
          <div className="mt-4">
            <AmountPicker servings={servings} onChange={setServings} gramsPerServing={p.food.serving_grams} startInGrams={p.food.serving_unit === 'g'} />
          </div>
        )}
        <p className="mt-4 text-center text-sm">
          <span className="text-lg font-semibold">{t(p.kcal)}</span> kcal · <span className="font-semibold">{t(p.protein_g)}</span> g protein ·{' '}
          {t(p.carbs_g)} g carbs · {t(p.fat_g)} g fat
        </p>
        <button type="button" disabled={busy} onClick={() => void add()} className="mt-4 min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40">
          Add
        </button>
      </div>
    </div>
  )
}

type SearchState = { status: 'idle' | 'loading' | 'done' | 'error'; query: string; items: FoundFood[]; offline?: boolean }
const AUTO_DELAY_MS = 500

/**
 * Your own foods match instantly as you type (on the phone, works offline). USDA (whole foods + US brands) is
 * searched when you pause typing, or on Search. With the shared DEMO_KEY only on Search (30 requests an hour).
 * Open Food Facts text search was dropped: slow, often failing in Safari, and USDA covers US products.
 */
function SearchTab(props: { date: string; onPick: (f: FoundFood) => void; onPickMine: (r: RecentItem) => void; onLabel: () => void }) {
  const { date, onPick, onPickMine, onLabel } = props
  const { db } = useData()
  const [query, setQuery] = useState('')
  const [res, setRes] = useState<SearchState>({ status: 'idle', query: '', items: [] })
  const ctrl = useRef<AbortController | null>(null)
  const cache = useRef(new Map<string, FoundFood[]>()) // backspacing doesn't search again
  useEffect(() => () => ctrl.current?.abort(), [])
  const mineAll = useLiveQuery(() => recentFoods(db, date, 365, 500), [db, date])
  const q = query.trim()
  const mine = q.length >= 2 ? (mineAll ?? []).filter((r) => matchesQuery(`${r.name} ${r.food?.brand ?? ''}`, q)).slice(0, 8) : []

  function search(text: string) {
    if (text.length < 2 || (text === res.query && res.status !== 'error')) return
    ctrl.current?.abort()
    const hit = cache.current.get(text.toLowerCase())
    if (hit) return setRes({ status: 'done', query: text, items: hit })
    const c = new AbortController()
    ctrl.current = c
    setRes((r) => ({ status: 'loading', query: text, items: r.items }))
    // USDA is sometimes slow or drops a request: retry quietly (after 1 s, then 3 s) instead of showing an error.
    const attempt = (n: number): void => {
      searchUsda(text, c.signal).then(
        (items) => {
          cache.current.set(text.toLowerCase(), items)
          if (!c.signal.aborted) setRes({ status: 'done', query: text, items })
        },
        () => {
          if (c.signal.aborted) return
          if (n < 2 && navigator.onLine) setTimeout(() => !c.signal.aborted && attempt(n + 1), n === 0 ? 1000 : 3000)
          else setRes({ status: 'error', query: text, items: [], offline: !navigator.onLine })
        },
      )
    }
    attempt(0)
  }

  // As you type: wait for a short pause, then search (each new letter cancels the wait).
  useEffect(() => {
    if (usingDemoKey || q.length < 3) return
    const t = setTimeout(() => search(q), AUTO_DELAY_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function run(e: React.FormEvent) {
    e.preventDefault()
    ;(document.activeElement as HTMLElement | null)?.blur() // hide the iOS keyboard so results are visible
    search(q)
  }

  // Hide USDA results you already have a copy of (they're under Your foods).
  const mineIds = new Set(mine.map((r) => r.food?.source_id).filter(Boolean))
  const results = res.items.filter((f) => !mineIds.has(f.source_id))
  const loading = res.status === 'loading'
  const searched = res.status !== 'idle'
  return (
    <div>
      <form onSubmit={run} className="flex gap-2" role="search">
        <input
          type="search"
          enterKeyHint="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. chicken breast, Fage 0%"
          aria-label="Search foods"
          className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent"
        />
        <button type="submit" aria-label="Search" disabled={query.trim().length < 2} className="grid size-12 place-items-center rounded-xl bg-accent text-accent-ink disabled:opacity-40">
          <Search size={20} />
        </button>
      </form>
      {mine.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold text-muted uppercase">Your foods</p>
          <ul>
            {mine.map((r) => (
              <li key={r.key}>
                <button type="button" onClick={() => onPickMine(r)} className="flex min-h-14 w-full items-center gap-3 border-b border-border py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.name}</span>
                    <span className="block text-xs text-muted">
                      {r.food ? servingLabel(r.food) : 'Quick add'} · {Math.round(r.kcal)} kcal · {Math.round(r.protein_g)} g protein
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {!searched && mine.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">
          Searches USDA: whole foods (meat, eggs, rice…) and US brands.
          {usingDemoKey && <span className="mt-2 block text-amber-400">Using USDA's shared demo key: limited searches per hour.</span>}
        </p>
      )}
      {res.status === 'error' && res.offline && <p className="mt-3 text-sm text-muted">You're offline. Your foods still work; USDA results need a connection.</p>}
      {results.length > 0 && <p className="mt-3 text-xs font-semibold text-muted uppercase">USDA</p>}
      <ul>
        {results.map((f) => (
          <li key={`${f.source}:${f.source_id}`}>
            <button type="button" onClick={() => onPick(f)} className="flex min-h-14 w-full items-center gap-3 border-b border-border py-2 text-left">
              <span className="min-w-0 flex-1">
                <span className="block line-clamp-2">{f.name}</span>
                <span className="block truncate text-xs text-muted">
                  {f.brand ? `${f.brand} · ` : ''}
                  {servingLabel(f)} · {f.kcal} kcal · {Math.round(f.protein_g)} g protein
                </span>
              </span>
              <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{f.generic ? 'Whole food' : 'Brand'}</span>
            </button>
          </li>
        ))}
      </ul>
      {loading && results.length === 0 && <p className="py-4 text-center text-sm text-muted">Searching USDA…</p>}
      {res.status === 'done' && results.length === 0 && mine.length === 0 && <p className="py-6 text-center text-sm text-muted">Nothing found. Try fewer words.</p>}
      {searched && !loading && (
        <button type="button" onClick={onLabel} className="mt-4 min-h-12 w-full rounded-xl border border-border text-sm">
          Not here? Type it from the label
        </button>
      )}
    </div>
  )
}

/** Type in a nutrition label. Saves it as your own food (shows in Recent next time), then logs it. */
function LabelTab({ date, slot, barcode, onDone }: { date: string; slot: MealSlot; barcode: string | null; onDone: () => void }) {
  const { store } = useData()
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [servingAmount, setServingAmount] = useState<number | null>(1)
  const [servingUnit, setServingUnit] = useState('serving')
  const [grams, setGrams] = useState<number | null>(null)
  const [macros, setMacros] = useState<MacroValues>(EMPTY_MACROS)
  const [extras, setExtras] = useState<Extras>({})
  const [servings, setServings] = useState(1)
  const ok = name.trim() !== '' && macrosValid(macros) && (servingAmount ?? 0) > 0

  async function save() {
    const extraCols = Object.fromEntries(EXTRA_NUTRIENTS.map((n) => [foodCol(n.key), extras[n.key] ?? null]))
    const food: Food = await createCustomFood(store, {
      name: name.trim(), brand: brand.trim() || null, serving_amount: servingAmount ?? 1, serving_unit: servingUnit.trim() || 'serving',
      serving_grams: grams, kcal: effectiveKcal(macros) ?? 0, protein_g: macros.protein ?? 0, carbs_g: macros.carbs ?? 0, fat_g: macros.fat ?? 0,
      barcode, ...extraCols,
    })
    await logFood(store, date, slot, food, servings)
    onDone()
  }

  const text = 'h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent'
  return (
    <div className="space-y-3">
      {barcode && <p className="rounded-xl bg-surface p-3 text-sm text-muted">Barcode {barcode} is saved with this food, so scanning it next time finds it.</p>}
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
      <MacroFields values={macros} onChange={setMacros} />
      <ExtraFields values={extras} onChange={setExtras} />
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
  const [macros, setMacros] = useState<MacroValues>(EMPTY_MACROS)

  async function save() {
    const { protein, carbs, fat } = macros
    await logQuickAdd(store, date, slot, { name: name.trim() || 'Quick add', kcal: effectiveKcal(macros) ?? 0, protein_g: protein ?? 0, carbs_g: carbs ?? 0, fat_g: fat ?? 0 })
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
      <MacroFields values={macros} onChange={setMacros} optionalMacros />
      <button type="button" disabled={!macrosValid(macros)} onClick={() => void save()} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40">
        Add
      </button>
    </div>
  )
}
