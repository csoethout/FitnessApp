import { ChartLine, ChevronLeft, Dumbbell, Ellipsis, House, Utensils, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Stepper } from '@/components/Stepper'
import { useData } from '@/data/DataProvider'
import { applySetup, loadEquipmentOf, loadSetupDefaults, skipSetup, type SetupAnswers } from '@/data/onboarding'
import { useFeatures } from '@/data/profile'
import { localDateKey } from '@/lib/body'
import { WEEKDAYS, WEEKDAYS_SHORT } from '@/lib/dates'
import { FEATURES } from '@/lib/features'
import { GYM_PRESETS } from '@/lib/gyms'
import { ACTIVITY, ageOn, computePlan, GOALS, type ActivityLevel, type GoalType, type Sex } from '@/lib/planner/nutrition'
import { defaultDays, generateSplit, type EquipmentOf, type Experience } from '@/lib/planner/split'
import { lbToKg } from '@/lib/units'

const STEPS = ['Welcome', 'About you', 'Goal', 'Training', 'Gym', 'The app', 'Features', 'Your plan'] as const
const MINUTES = [30, 45, 60, 75]
const EXPERIENCE: { key: Experience; label: string; detail: string }[] = [
  { key: 'new', label: 'New to lifting', detail: 'Full-body days, lighter volume, 8–12 reps' },
  { key: 'returning', label: 'Coming back', detail: "I've lifted before and know the main exercises" },
  { key: 'experienced', label: 'Experienced', detail: 'Training steadily for a year or more' },
]
const TOUR: { icon: LucideIcon; tab: string; text: string }[] = [
  { icon: House, tab: 'Today', text: "Today's workout with one Start button, plus quick cards: weigh-in, sleep, water, cardio and food." },
  { icon: Dumbbell, tab: 'Train', text: 'Your weekly plan (tap a day to change exercises), Plan my week for busy or travel days, and past workouts.' },
  { icon: Utensils, tab: 'Food', text: 'Log meals from recent foods, search, barcode scan or the label. Your calorie and protein targets live here.' },
  { icon: ChartLine, tab: 'Progress', text: 'Strength trends and PRs per lift, sets per muscle, and your body weight and sleep.' },
  { icon: Ellipsis, tab: 'More', text: 'Gyms, workout settings, switching features on or off, exporting your data, and this setup again.' },
]

/**
 * First-run setup: a short walk through the app that also collects the basics (you, goal, schedule, gym,
 * features) and builds a starting week. Re-runnable from More; an existing week is kept unless you choose otherwise.
 */
export function SetupScreen() {
  const { db, store } = useData()
  const features = useFeatures()
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadSetupDefaults>> & { equipmentOf: EquipmentOf; names: Map<string, string> }>()
  useEffect(() => {
    if (!features || loaded) return
    void (async () => {
      const defaults = await loadSetupDefaults(db, store.userId, features)
      const names = new Map((await db.exercises.toArray()).map((e) => [e.source_id ?? e.id, e.name]))
      setLoaded({ ...defaults, equipmentOf: await loadEquipmentOf(db), names })
    })()
  }, [db, store.userId, features, loaded])
  if (!loaded) return null
  return <Wizard {...loaded} />
}

function Wizard(props: { answers: SetupAnswers; hasWeek: boolean; hasWeight: boolean; rerun: boolean; equipmentOf: EquipmentOf; names: Map<string, string> }) {
  const { store } = useData()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [a, setA] = useState<SetupAnswers>(() => ({
    ...props.answers,
    gymEquipment: props.answers.gymEquipment.length ? props.answers.gymEquipment : GYM_PRESETS[0].equipment,
  }))
  const [saving, setSaving] = useState(false)
  const set = (changes: Partial<SetupAnswers>) => setA((prev) => ({ ...prev, ...changes }))
  const [today] = useState(() => localDateKey(new Date()))

  const age = a.birthDate ? ageOn(a.birthDate, today) : null
  const ageOk = age !== null && age >= 13 && age <= 100
  const canNext = [true, !!a.sex && ageOk, true, a.days.length > 0, true, true, true, true][step]
  const last = step === STEPS.length - 1

  async function finish() {
    setSaving(true)
    await applySetup(store, a, { hasWeight: props.hasWeight })
    navigate('/', { replace: true })
  }
  async function skip() {
    await skipSetup(store)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-h-12 items-center">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className="-ml-2 flex min-h-12 items-center pr-3 text-muted">
              <ChevronLeft size={20} /> Back
            </button>
          ) : (
            <span />
          )}
          <span className="ml-auto text-sm text-muted">
            {step + 1} of {STEPS.length}
          </span>
          {props.rerun && (
            <button type="button" onClick={() => navigate('/more', { replace: true })} className="-mr-2 ml-2 flex min-h-12 items-center px-2 text-muted">
              Close
            </button>
          )}
        </div>
        <div className="flex gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-surface-2'}`} />
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-5 pb-6">
        {step === 0 && <Welcome a={a} set={set} onSkip={() => void skip()} />}
        {step === 1 && <AboutYou a={a} set={set} needsWeight={!props.hasWeight} age={age} ageOk={ageOk} />}
        {step === 2 && <GoalStep a={a} set={set} />}
        {step === 3 && <TrainingStep a={a} set={set} />}
        {step === 4 && <GymStep a={a} set={set} />}
        {step === 5 && <TourStep />}
        {step === 6 && <FeaturesStep a={a} set={set} />}
        {step === 7 && <Summary a={a} set={set} {...props} today={today} />}
      </main>

      <footer className="border-t border-border bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={!canNext || saving}
          onClick={() => (last ? void finish() : setStep(step + 1))}
          className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40"
        >
          {step === 0 ? "Let's go" : last ? (saving ? 'Setting up…' : 'Finish setup') : 'Next'}
        </button>
      </footer>
    </div>
  )
}

type StepProps = { a: SetupAnswers; set: (c: Partial<SetupAnswers>) => void }

const card = (on: boolean) => `w-full rounded-xl border px-4 py-3 text-left ${on ? 'border-accent bg-accent/10' : 'border-border bg-surface'}`
const chip = (on: boolean) => `min-h-12 flex-1 rounded-xl border ${on ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`

function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  )
}

function Choice<T extends string>(props: { options: { key: T; label: string; detail: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="space-y-2" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={o.key} type="button" aria-pressed={props.value === o.key} onClick={() => props.onChange(o.key)} className={card(props.value === o.key)}>
          <span className="block">{o.label}</span>
          <span className="block text-xs text-muted">{o.detail}</span>
        </button>
      ))}
    </div>
  )
}

function Welcome({ a, set, onSkip }: StepProps & { onSkip: () => void }) {
  return (
    <>
      <img src="/pwa-192.png" alt="" className="mx-auto mb-4 size-24 rounded-3xl" />
      <Title sub="A few quick questions (about 2 minutes). I'll build your first training week and your calorie and protein targets, and show you around.">
        Welcome to Soev's Strength Lab
      </Title>
      <label className="block">
        <span className="mb-1 block font-semibold">What should I call you?</span>
        <input
          value={a.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="First name (optional)"
          autoComplete="given-name"
          className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent"
        />
      </label>
      <p className="mt-4 text-xs text-muted">You can change every answer later. Not medical advice: check with a doctor before starting a new training or diet plan.</p>
      <button type="button" onClick={onSkip} className="mt-6 min-h-12 w-full text-sm text-muted">
        Skip setup, I'll set things up myself
      </button>
    </>
  )
}

function AboutYou({ a, set, needsWeight, age, ageOk }: StepProps & { needsWeight: boolean; age: number | null; ageOk: boolean }) {
  const feet = Math.floor(a.heightIn / 12)
  const inches = a.heightIn % 12
  return (
    <>
      <Title sub="Used to estimate how many calories you burn.">About you</Title>
      <div className="space-y-5">
        <div>
          <p className="mb-2 font-semibold">Sex</p>
          <div className="flex gap-2" role="group" aria-label="Sex">
            {(['male', 'female'] as Sex[]).map((s) => (
              <button key={s} type="button" aria-pressed={a.sex === s} onClick={() => set({ sex: s })} className={chip(a.sex === s) + ' capitalize'}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">
            Birth date
            {a.birthDate && !ageOk && <span className="block text-xs font-normal text-danger">Check the year</span>}
            {ageOk && <span className="block text-xs font-normal text-muted">{age} years old</span>}
          </span>
          <input type="date" value={a.birthDate} onChange={(e) => set({ birthDate: e.target.value })} className="h-12 rounded-xl border border-border bg-surface-2 px-3 text-base" />
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">Height</span>
          <div className="flex items-center gap-1">
            <Stepper label="feet" value={feet} min={4} max={7} onChange={(f) => set({ heightIn: f * 12 + inches })} format={(v) => `${v}′`} />
            <Stepper label="inches" value={inches} min={0} max={11} onChange={(i) => set({ heightIn: feet * 12 + i })} format={(v) => `${v}″`} />
          </div>
        </div>
        {needsWeight && (
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">
              Weight <span className="block text-xs font-normal text-muted">saved as today's weigh-in</span>
            </span>
            <Stepper label="weight" value={a.weightLb} min={80} max={600} onChange={(w) => set({ weightLb: w })} onTypeValue={(v) => set({ weightLb: Math.round(v) })} format={(v) => `${v} lb`} />
          </div>
        )}
      </div>
    </>
  )
}

function GoalStep({ a, set }: StepProps) {
  const goals = (Object.keys(GOALS) as GoalType[]).map((k) => ({ key: k, label: GOALS[k].label, detail: GOALS[k].detail }))
  const activity = (Object.keys(ACTIVITY) as ActivityLevel[]).map((k) => ({ key: k, label: ACTIVITY[k].label, detail: ACTIVITY[k].detail }))
  return (
    <>
      <Title sub="Sets your calorie target. The app checks your weight trend every 2 weeks and adjusts.">What's your goal?</Title>
      <Choice label="Goal" options={goals} value={a.goal} onChange={(goal) => set({ goal })} />
      <p className="mt-6 mb-2 font-semibold">How active are you overall?</p>
      <Choice label="Activity" options={activity} value={a.activity} onChange={(v) => set({ activity: v })} />
    </>
  )
}

function TrainingStep({ a, set }: StepProps) {
  const toggle = (d: number) => set({ days: a.days.includes(d) ? a.days.filter((x) => x !== d) : [...a.days, d].sort() })
  return (
    <>
      <Title sub="I'll build a week to match. Plan my week (Train tab) handles busy or travel days later.">Your training</Title>
      <p className="mb-2 font-semibold">Days per week</p>
      <div className="mb-2 flex gap-1" role="group" aria-label="Days per week">
        {[2, 3, 4, 5, 6].map((n) => (
          <button key={n} type="button" aria-pressed={a.days.length === n} onClick={() => set({ days: defaultDays(n) })} className={chip(a.days.length === n)}>
            {n}
          </button>
        ))}
      </div>
      <p className="mb-2 text-xs text-muted">Which days? Tap to change.</p>
      <div className="mb-6 flex gap-1" role="group" aria-label="Training days">
        {WEEKDAYS_SHORT.map((d, i) => (
          <button key={d} type="button" aria-pressed={a.days.includes(i)} aria-label={WEEKDAYS[i]} onClick={() => toggle(i)} className={chip(a.days.includes(i)) + ' text-sm'}>
            {d.slice(0, 2)}
          </button>
        ))}
      </div>
      {a.days.length > 6 && <p className="-mt-4 mb-6 text-xs text-muted">Six training days is the most I'll plan: one day stays a rest day.</p>}
      <p className="mb-2 font-semibold">Time per workout</p>
      <div className="mb-6 flex gap-1" role="group" aria-label="Minutes per workout">
        {MINUTES.map((m) => (
          <button key={m} type="button" aria-pressed={a.minutes === m} onClick={() => set({ minutes: m })} className={chip(a.minutes === m)}>
            {m} min
          </button>
        ))}
      </div>
      <p className="mb-2 font-semibold">Experience</p>
      <Choice label="Experience" options={EXPERIENCE} value={a.experience} onChange={(experience) => set({ experience })} />
    </>
  )
}

function GymStep({ a, set }: StepProps) {
  const current = GYM_PRESETS.findIndex((p) => p.equipment.length === a.gymEquipment.length && p.equipment.every((e) => a.gymEquipment.includes(e)))
  return (
    <>
      <Title sub="Exercises are picked from what you have. Fine-tune it or add a hotel or home gym later in More → Gyms.">Where do you train?</Title>
      <div className="space-y-2" role="group" aria-label="Gym">
        {GYM_PRESETS.map((p, i) => (
          <button key={p.label} type="button" aria-pressed={current === i} onClick={() => set({ gymEquipment: p.equipment })} className={card(current === i)}>
            <span className="block">{p.label}</span>
            <span className="block text-xs text-muted">{p.detail}</span>
          </button>
        ))}
        {current < 0 && <p className="text-xs text-muted">Your gym's current equipment is kept unless you pick one of these.</p>}
      </div>
    </>
  )
}

function TourStep() {
  return (
    <>
      <Title sub="Five tabs along the bottom, where your thumb is.">How the app works</Title>
      <ul className="space-y-3">
        {TOUR.map(({ icon: Icon, tab, text }) => (
          <li key={tab} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
            <Icon size={24} className="shrink-0 text-accent" aria-hidden />
            <span>
              <span className="block font-semibold">{tab}</span>
              <span className="block text-sm text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-muted">
        In a workout: sets are pre-filled with today's target. Tap ✓ to log a set as is, or the numbers to change them. Everything saves on your phone
        first, so bad gym Wi-Fi is fine.
      </p>
    </>
  )
}

function FeaturesStep({ a, set }: StepProps) {
  return (
    <>
      <Title sub="Turn off what you don't care about. It's hidden, not deleted, and you can switch it back in More → Features.">What do you want to track?</Title>
      <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
        <div className="flex min-h-14 items-center gap-3 px-4 py-2">
          <span className="flex-1">
            Workouts
            <span className="block text-xs text-muted">Always on</span>
          </span>
          <input type="checkbox" checked disabled className="size-6 accent-accent opacity-60" aria-label="Workouts (always on)" />
        </div>
        {FEATURES.filter((f) => f.key !== 'testingTools').map((f) => (
          <label key={f.key} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span className="flex-1">
              {f.label}
              <span className="block text-xs text-muted">{f.detail}</span>
            </span>
            <input
              type="checkbox"
              checked={a.features[f.key]}
              onChange={(e) => set({ features: { ...a.features, [f.key]: e.target.checked } })}
              className="size-6 accent-accent"
            />
          </label>
        ))}
      </div>
    </>
  )
}

function Summary(props: StepProps & { hasWeek: boolean; equipmentOf: EquipmentOf; names: Map<string, string>; today: string }) {
  const { a, set } = props
  const week = useMemo(
    () => generateSplit({ days: a.days, minutes: a.minutes, experience: a.experience, equipment: a.gymEquipment }, props.equipmentOf),
    [a.days, a.minutes, a.experience, a.gymEquipment, props.equipmentOf],
  )
  const plan =
    a.sex && a.birthDate
      ? computePlan({ sex: a.sex, ageYears: ageOn(a.birthDate, props.today), heightCm: a.heightIn * 2.54, weightKg: lbToKg(a.weightLb), activity: a.activity, goal: a.goal })
      : null
  const showWeek = a.week === 'new'
  return (
    <>
      <Title sub="Check it over. Everything can be changed later.">{a.name.trim() ? `${a.name.trim()}, here's your plan` : "Here's your plan"}</Title>
      {a.features.food && plan && (
        <section className="mb-4 rounded-2xl border border-border bg-surface p-4" aria-label="Daily targets">
          <p className="text-sm text-muted">Daily targets · {GOALS[a.goal].label}</p>
          <p className="mt-1">
            <span className="text-2xl font-semibold tabular-nums">{plan.kcal.toLocaleString()}</span> <span className="text-muted">kcal</span>
            <span className="ml-4 text-2xl font-semibold tabular-nums">{plan.protein_g}</span> <span className="text-muted">g protein</span>
          </p>
          <p className="text-xs text-muted">
            Carbs {plan.carbs_g} g · fat {plan.fat_g} g. Updates with your weigh-ins.
          </p>
        </section>
      )}
      {props.hasWeek && (
        <div className="mb-4">
          <p className="mb-2 font-semibold">You already have a weekly plan</p>
          <div className="flex gap-2" role="group" aria-label="Weekly plan">
            <button type="button" aria-pressed={a.week === 'keep'} onClick={() => set({ week: 'keep' })} className={chip(a.week === 'keep')}>
              Keep mine
            </button>
            <button type="button" aria-pressed={a.week === 'new'} onClick={() => set({ week: 'new' })} className={chip(a.week === 'new')}>
              Use a new one
            </button>
          </div>
          {a.week === 'new' && <p className="mt-2 text-xs text-muted">Your current days are replaced by the ones below. Past workouts are kept.</p>}
        </div>
      )}
      {showWeek && (
        <section aria-label="Your week">
          <p className="mb-2 font-semibold">
            Your week <span className="text-sm font-normal text-muted">· {a.minutes} min sessions</span>
          </p>
          <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
            {week.map((d) => (
              <li key={d.dayOfWeek} className="border-b border-border px-4 py-3 last:border-b-0">
                <span className="flex items-baseline gap-3">
                  <span className="w-10 shrink-0 text-sm text-muted">{WEEKDAYS_SHORT[d.dayOfWeek]}</span>
                  <span className={d.rest ? 'text-muted' : 'font-medium'}>{d.rest ? 'Rest' : d.name}</span>
                </span>
                {!d.rest && (
                  <span className="mt-0.5 block pl-13 text-xs text-muted">
                    {d.exercises.map((e) => `${props.names.get(e.sourceId) ?? e.sourceId}${e.main ? ' ★' : ''}`).join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            ★ main lift. The first time, pick a weight you can lift for the reps shown; after that the app suggests your next target (more reps,
            then more weight). Edit any day on the Train tab.
          </p>
        </section>
      )}
    </>
  )
}
