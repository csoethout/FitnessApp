import { ChevronLeft, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { CheckInCard } from '@/components/CheckInCard'
import { Stepper } from '@/components/Stepper'
import { saveWeighIn } from '@/data/body'
import { useData } from '@/data/DataProvider'
import { resetCheckIns, saveProfile, setGoal, setNutritionAdjust, useNutritionPlan, type PlanState } from '@/data/profile'
import { localDateKey } from '@/lib/body'
import { formatDay } from '@/lib/dates'
import { ACTIVITY, GOALS, type ActivityLevel, type Adjustments, type GoalType, type Sex } from '@/lib/planner/nutrition'
import { kgToLb, lbToKg } from '@/lib/units'

// Neutral starting values for an empty profile (the setup wizard normally fills these in first).
const DEFAULTS = { heightIn: 69, weightLb: 170, activity: 'moderate' as ActivityLevel, goal: 'recomp' as GoalType }

/** Your nutrition plan: calculated from your details, explained, and fine-tunable with small −/+ nudges. */
export function NutritionPlanScreen() {
  const state = useNutritionPlan()
  const [editing, setEditing] = useState(false)
  if (!state) return null
  const needsDetails = state.missing.length > 0

  return (
    <>
      <Link to="/food" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
        <ChevronLeft size={20} /> Food
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">Your nutrition plan</h1>
      {needsDetails || editing ? (
        <DetailsForm state={state} onDone={() => setEditing(false)} firstTime={needsDetails} />
      ) : (
        <PlanView state={state} onEdit={() => setEditing(true)} />
      )}
      <p className="mt-6 text-center text-xs text-muted">Estimates from standard formulas. Not medical advice.</p>
    </>
  )
}

function PlanView({ state, onEdit }: { state: PlanState; onEdit: () => void }) {
  const { store } = useData()
  const plan = state.plan!
  const base = state.base!
  const adjust = state.adjust
  const nudge = (key: keyof Adjustments, delta: number) => void setNutritionAdjust(store, { ...adjust, [key]: adjust[key] + delta })
  const nudged = adjust.kcal !== 0 || adjust.protein_g !== 0 || adjust.fat_g !== 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {GOALS[state.inputs!.goal].label} · based on your 7-day average of {kgToLb(state.weightKg!).toFixed(1)} lb. Updates as your weight
        changes.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Calories" value={plan.kcal.toLocaleString()} unit="kcal" big />
        <Tile label="Protein" value={String(plan.protein_g)} unit="g" big />
        <Tile label="Carbs" value={String(plan.carbs_g)} unit="g" />
        <Tile label="Fat" value={String(plan.fat_g)} unit="g" />
      </div>
      {plan.limited && <p className="rounded-xl border border-amber-400/50 p-3 text-sm text-amber-400">{plan.limited}</p>}
      <CheckInCard state={state} />

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-semibold">Fine-tune</h2>
          {nudged && (
            <button type="button" onClick={() => void setNutritionAdjust(store, { kcal: 0, protein_g: 0, fat_g: 0 })} className="min-h-10 text-sm text-accent">
              Back to plan
            </button>
          )}
        </div>
        <p className="mb-2 text-xs text-muted">Nudges stay on top of the plan when it recalculates. Carbs adjust to fit.</p>
        <Nudge label="Calories" value={plan.kcal} unit="kcal" offset={adjust.kcal} step={50} onNudge={(d) => nudge('kcal', d)} />
        <Nudge label="Protein" value={plan.protein_g} unit="g" offset={adjust.protein_g} step={5} onNudge={(d) => nudge('protein_g', d)} />
        <Nudge label="Fat" value={plan.fat_g} unit="g" offset={adjust.fat_g} step={5} onNudge={(d) => nudge('fat_g', d)} />
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 font-semibold">How we got here</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          {base.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
          {state.checkIn.totalKcal !== 0 && (
            <li>
              2-week check-ins since {formatDay(state.goal!.start_date + 'T12:00:00')}: {state.checkIn.totalKcal > 0 ? '+' : '−'}
              {Math.abs(state.checkIn.totalKcal)} kcal, based on your weight trend.{' '}
              <button type="button" onClick={() => void resetCheckIns(store, state.goal!.start_date)} className="text-accent underline">
                Reset
              </button>
            </li>
          )}
          <li>Every 2 weeks the app checks your weight trend against your goal and suggests ±100–150 kcal.</li>
        </ol>
      </section>

      <button type="button" onClick={onEdit} className="min-h-12 w-full rounded-xl border border-border">
        Edit my details or goal
      </button>
    </div>
  )
}

/** A row with small round −/+ buttons ("dots") and how far you are from the plan. */
function Nudge(props: { label: string; value: number; unit: string; offset: number; step: number; onNudge: (delta: number) => void }) {
  const { label, value, unit, offset, step, onNudge } = props
  return (
    <div className="flex min-h-12 items-center gap-3">
      <span className="flex-1">
        {label}
        <span className="block text-xs text-muted">{offset === 0 ? 'as planned' : `${offset > 0 ? '+' : ''}${offset} ${unit} vs plan`}</span>
      </span>
      <button type="button" aria-label={`${label} down ${step}`} onClick={() => onNudge(-step)} className="grid size-10 place-items-center rounded-full bg-surface-2">
        <Minus size={16} />
      </button>
      <span className="w-20 text-center font-semibold tabular-nums">
        {value.toLocaleString()} <span className="text-xs font-normal text-muted">{unit}</span>
      </span>
      <button type="button" aria-label={`${label} up ${step}`} onClick={() => onNudge(step)} className="grid size-10 place-items-center rounded-full bg-surface-2">
        <Plus size={16} />
      </button>
    </div>
  )
}

function Tile({ label, value, unit, big }: { label: string; value: string; unit: string; big?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`${big ? 'text-3xl' : 'text-xl'} font-semibold tabular-nums`}>
        {value} <span className="text-sm font-normal text-muted">{unit}</span>
      </p>
    </div>
  )
}

/** Your details. Pre-filled from your profile; weight is only asked for until you've weighed in. */
function DetailsForm({ state, onDone, firstTime }: { state: PlanState; onDone: () => void; firstTime: boolean }) {
  const { store } = useData()
  const p = state.profile
  const [sex, setSex] = useState<Sex | null>(p?.sex ?? null)
  const [birthDate, setBirthDate] = useState(p?.birth_date ?? '')
  const startIn = p?.height_cm ? Math.round(p.height_cm / 2.54) : DEFAULTS.heightIn
  const [feet, setFeet] = useState(Math.floor(startIn / 12))
  const [inches, setInches] = useState(startIn % 12)
  const [weightLb, setWeightLb] = useState(DEFAULTS.weightLb)
  const [activity, setActivity] = useState<ActivityLevel>(p?.activity_level ?? DEFAULTS.activity)
  const [goal, setGoalType] = useState<GoalType>(state.goal?.goal_type ?? DEFAULTS.goal)
  const needsWeight = state.weightKg === null

  const complete = !!sex && !!birthDate

  async function save() {
    if (!complete) return
    const today = localDateKey(new Date())
    await saveProfile(store, { sex, birth_date: birthDate, height_cm: Math.round((feet * 12 + inches) * 2.54 * 10) / 10, activity_level: activity })
    let weightKg = state.weightKg
    if (needsWeight) {
      weightKg = Math.round(lbToKg(weightLb) * 10_000) / 10_000
      await saveWeighIn(store, today, { weight_kg: weightKg, body_fat_pct: null, muscle_mass_kg: null })
    }
    await setGoal(store, goal, today, weightKg)
    onDone()
  }

  const chip = (on: boolean) => `min-h-11 flex-1 rounded-xl border ${on ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`
  const card = (on: boolean) => `w-full rounded-xl border px-4 py-3 text-left ${on ? 'border-accent bg-accent/10' : 'border-border'}`

  return (
    <div className="space-y-5">
      {firstTime && <p className="text-sm text-muted">Fill in your details, then I'll calculate your targets.</p>}
      <div>
        <p className="mb-2 font-semibold">Sex</p>
        <div className="flex gap-2">
          {(['male', 'female'] as Sex[]).map((s) => (
            <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)} className={chip(sex === s) + ' capitalize'}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span className="font-semibold">Birth date</span>
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-12 rounded-xl border border-border bg-surface-2 px-3 text-base" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">Height</span>
        <div className="flex items-center gap-1">
          <Stepper label="feet" value={feet} min={4} max={7} onChange={setFeet} format={(v) => `${v}′`} />
          <Stepper label="inches" value={inches} min={0} max={11} onChange={setInches} format={(v) => `${v}″`} />
        </div>
      </div>
      {needsWeight && (
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">
            Weight today <span className="block text-xs font-normal text-muted">saved as a weigh-in</span>
          </span>
          <Stepper label="weight" value={weightLb} step={1} min={80} max={600} onChange={setWeightLb} onTypeValue={(v) => setWeightLb(Math.round(v))} format={(v) => `${v} lb`} />
        </div>
      )}
      <div>
        <p className="mb-2 font-semibold">Activity</p>
        <div className="space-y-2">
          {(Object.keys(ACTIVITY) as ActivityLevel[]).map((a) => (
            <button key={a} type="button" aria-pressed={activity === a} onClick={() => setActivity(a)} className={card(activity === a)}>
              <span className="block">{ACTIVITY[a].label}</span>
              <span className="block text-xs text-muted">{ACTIVITY[a].detail}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 font-semibold">Goal</p>
        <div className="space-y-2">
          {(Object.keys(GOALS) as GoalType[]).map((g) => (
            <button key={g} type="button" aria-pressed={goal === g} onClick={() => setGoalType(g)} className={card(goal === g)}>
              <span className="block">{GOALS[g].label}</span>
              <span className="block text-xs text-muted">{GOALS[g].detail}</span>
            </button>
          ))}
        </div>
      </div>
      <button type="button" disabled={!complete} onClick={() => void save()} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40">
        {firstTime ? 'Calculate my plan' : 'Save'}
      </button>
      {!firstTime && (
        <button type="button" onClick={onDone} className="min-h-12 w-full text-sm text-muted">
          Cancel
        </button>
      )}
    </div>
  )
}
