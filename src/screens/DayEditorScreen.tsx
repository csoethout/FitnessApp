import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ExercisePicker } from '@/components/ExercisePicker'
import { Stepper } from '@/components/Stepper'
import { useData } from '@/data/DataProvider'
import { useTemplateDay, type DayExercise } from '@/data/queries'
import { useStartWorkout } from '@/data/useStartWorkout'
import type { Exercise } from '@/data/types'
import { formatRest, WEEKDAYS } from '@/lib/dates'
import { defaultRepRange, defaultRestSeconds } from '@/lib/training'

/** Edit one day of the weekly template: name, rest day, and its exercises (sets, reps, main lift, order). */
export function DayEditorScreen() {
  const { dayId } = useParams()
  const data = useTemplateDay(dayId)
  const { store } = useData()
  const [picking, setPicking] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const start = useStartWorkout()
  const usedIds = useMemo(() => new Set(data?.items.map((it) => it.exercise_id)), [data])

  if (data === undefined) return null
  if (data === null) return <p className="text-muted">Day not found.</p>
  const { day, items } = data

  async function addExercise(e: Exercise) {
    setPicking(false)
    const [repMin, repMax] = defaultRepRange(e.mechanic)
    const row = await store.insert('plan_template_exercises', {
      template_day_id: day.id, exercise_id: e.id, position: items.length, sets: 3, rep_min: repMin, rep_max: repMax,
      is_main_lift: false, rest_seconds: null,
    })
    setOpenId(row.id)
  }

  async function move(index: number, delta: -1 | 1) {
    const order = [...items]
    const [moved] = order.splice(index, 1)
    order.splice(index + delta, 0, moved)
    // Rewrite positions 0..n so the order is unambiguous on every device.
    await Promise.all(order.map((it, i) => (it.position === i ? null : store.update('plan_template_exercises', it.id, { position: i }))))
  }

  return (
    <>
      <Link to="/train" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
        <ChevronLeft size={20} /> Week
      </Link>

      <p className="text-sm text-muted">{WEEKDAYS[day.day_of_week]}</p>
      <input
        key={day.updated_at}
        defaultValue={day.name}
        aria-label="Day name"
        onBlur={(e) => {
          const name = e.target.value.trim()
          if (name && name !== day.name) void store.update('plan_template_days', day.id, { name })
        }}
        className="mb-3 w-full rounded-lg bg-transparent text-2xl font-semibold outline-none focus:bg-surface-2"
      />

      <label className="mb-4 flex min-h-12 items-center justify-between rounded-xl border border-border bg-surface px-4">
        <span>Rest day</span>
        <input
          type="checkbox"
          checked={day.is_rest}
          onChange={(e) => void store.update('plan_template_days', day.id, { is_rest: e.target.checked })}
          className="size-6 accent-accent"
        />
      </label>

      {!day.is_rest && (
        <>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => void start(day.id, day.name)}
              className="mb-4 min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink"
            >
              Start this workout
            </button>
          )}
          <ul className="space-y-2">
            {items.map((item, i) => (
              <ExerciseRow
                key={item.id}
                item={item}
                open={openId === item.id}
                onToggle={() => setOpenId(openId === item.id ? null : item.id)}
                onMoveUp={i > 0 ? () => void move(i, -1) : undefined}
                onMoveDown={i < items.length - 1 ? () => void move(i, 1) : undefined}
              />
            ))}
          </ul>
          {items.length === 0 && <p className="py-6 text-center text-muted">No exercises yet.</p>}
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mt-4 min-h-14 w-full rounded-xl border border-dashed border-border text-muted"
          >
            + Add exercise
          </button>
        </>
      )}

      {picking && (
        <ExercisePicker
          excludeIds={usedIds}
          onPick={(e) => void addExercise(e)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

function ExerciseRow(props: {
  item: DayExercise
  open: boolean
  onToggle: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}) {
  const { item, open, onToggle, onMoveUp, onMoveDown } = props
  const { store } = useData()
  const update = (changes: Partial<DayExercise>) => {
    // Strip the joined exercise before saving.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { exercise, ...rest } = changes
    void store.update('plan_template_exercises', item.id, rest)
  }
  const rest = item.rest_seconds ?? defaultRestSeconds(item.is_main_lift, item.exercise?.mechanic ?? null)

  return (
    <li className="rounded-2xl border border-border bg-surface">
      <button type="button" onClick={onToggle} className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left">
        <span className="flex-1">
          <span className="block font-medium">{item.exercise?.name ?? 'Unknown exercise'}</span>
          <span className="block text-sm text-muted">
            {item.sets} × {item.rep_min}–{item.rep_max} · {formatRest(rest)} rest
            {item.is_main_lift && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">Main lift</span>}
          </span>
        </span>
        <ChevronDown size={20} className={`text-muted transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3">
          <Field label="Sets">
            <Stepper label="sets" value={item.sets} min={1} max={10} onChange={(sets) => update({ sets })} />
          </Field>
          <Field label="Reps from">
            <Stepper label="minimum reps" value={item.rep_min} min={1} max={item.rep_max} onChange={(rep_min) => update({ rep_min })} />
          </Field>
          <Field label="Reps to">
            <Stepper label="maximum reps" value={item.rep_max} min={item.rep_min} max={50} onChange={(rep_max) => update({ rep_max })} />
          </Field>
          <label className="flex min-h-12 items-center justify-between gap-4">
            <span>
              Main lift
              <span className="block text-xs text-muted">3 min rest. Kept first when you're short on time.</span>
            </span>
            <input
              type="checkbox"
              checked={item.is_main_lift}
              onChange={(e) => update({ is_main_lift: e.target.checked })}
              className="size-6 accent-accent"
            />
          </label>
          <div className="flex gap-2 pt-1">
            <IconButton label="Move up" onClick={onMoveUp}>
              <ArrowUp size={20} />
            </IconButton>
            <IconButton label="Move down" onClick={onMoveDown}>
              <ArrowDown size={20} />
            </IconButton>
            <button
              type="button"
              onClick={() => void store.remove('plan_template_exercises', item.id)}
              className="ml-auto flex min-h-12 items-center gap-2 rounded-xl px-4 text-danger"
            >
              <Trash2 size={18} /> Remove
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      {children}
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={!onClick}
      className="grid size-12 place-items-center rounded-xl bg-surface-2 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
