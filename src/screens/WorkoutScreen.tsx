import { ArrowLeftRight, Check, ChevronLeft, Ellipsis, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useConfirm } from '@/components/ConfirmProvider'
import { ExercisePicker } from '@/components/ExercisePicker'
import { RestTimerBar } from '@/components/RestTimerBar'
import { Sheet, SheetAction } from '@/components/Sheet'
import { SwapSheet } from '@/components/SwapSheet'
import { Stepper } from '@/components/Stepper'
import { useData } from '@/data/DataProvider'
import { useMainGym, useWorkout, type WorkoutItem } from '@/data/queries'
import { markUnavailable, replaceInPlan, swapInWorkout } from '@/data/swap'
import type { Exercise, WorkoutSet } from '@/data/types'
import { addExercise, addSet, addWarmups, discardWorkout, finishWorkout } from '@/data/workouts'
import { cascadeIds, currentSetIndex, formatElapsed, formatLastTime, formatWeight } from '@/lib/logger'
import { unlockAudio } from '@/lib/beep'
import { restTimer } from '@/lib/restTimer'
import { restAfterSet } from '@/lib/training'
import { useWakeLock } from '@/lib/useWakeLock'
import { warmupPlan } from '@/lib/warmup'
import { displayWeight, toStoredKg, type WeightUnit } from '@/lib/units'
import { useNow } from '@/lib/useNow'

const UNIT: WeightUnit = 'lb' // Profile setting arrives in Phase 5; owner uses lb.
const WEIGHT_STEP = 5
const nowIso = () => new Date().toISOString()

/**
 * The gym screen. Design rules (CLAUDE.md → Logger UX):
 * - only the set you're on is expanded; done sets collapse to one line (tap to edit)
 * - the ✓ is the biggest target and logs the pre-filled values in one tap
 * - after ✓, an optional effort / "couldn't finish" row appears; ignoring it is fine
 */
export function WorkoutScreen() {
  const { workoutId } = useParams()
  const data = useWorkout(workoutId)
  const { store } = useData()
  const navigate = useNavigate()
  const now = useNow()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [justDoneId, setJustDoneId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  const gymInfo = useMainGym()
  const [menuFor, setMenuFor] = useState<WorkoutItem | null>(null)
  const [swapFor, setSwapFor] = useState<{ item: WorkoutItem; planDefault: boolean } | null>(null)
  const usedIds = useMemo(() => new Set(data?.items.map((it) => it.we.exercise_id)), [data])
  useWakeLock(Boolean(data?.workout && !data.workout.ended_at))

  if (data === undefined) return null
  if (data === null) {
    return (
      <div className="p-4">
        <p className="text-muted">This workout no longer exists.</p>
        <Link to="/train" className="text-accent">Back to Train</Link>
      </div>
    )
  }
  const { workout, items } = data
  const finished = Boolean(workout.ended_at)
  const remaining = items.reduce((n, it) => n + it.sets.filter((s) => !s.completed_at).length, 0)
  // The exercise you're on: the first one with sets left. Only its current set is shown big.
  const activeExerciseId = items.find((it) => currentSetIndex(it.sets) >= 0)?.we.id
  // Warm-ups are offered only for the first compound lift of the session (CLAUDE.md).
  const warmupExerciseId = items.find((it) => it.exercise?.mechanic === 'compound')?.we.id

  async function complete(set: WorkoutSet, item: WorkoutItem) {
    unlockAudio() // must happen during the tap for iOS to allow the end-of-rest beep
    const isLastSet = remaining === 1
    await store.update('sets', set.id, { completed_at: nowIso() })
    if (isLastSet) restTimer.skip()
    else restTimer.start(restAfterSet(set.set_type, item.restSeconds), workout.id)
    setEditingId(null)
    setJustDoneId(set.id)
    // Bring the next set into view (it may be in the next exercise card).
    requestAnimationFrame(() =>
      document.querySelector('[data-current-set="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }

  async function finish() {
    const ok = await confirm({
      title: 'Finish workout?',
      message: remaining > 0 ? `${remaining} set${remaining === 1 ? '' : 's'} not done will be removed.` : undefined,
      confirmLabel: 'Finish',
      cancelLabel: 'Keep going',
    })
    if (!ok) return
    try {
      await finishWorkout(store, workout.id)
      restTimer.skip()
      navigate(`/history/${workout.id}?new=1`)
    } catch (e) {
      setError(`Couldn't finish: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function swap(item: WorkoutItem, next: Exercise, alsoInPlan: boolean) {
    setSwapFor(null)
    await swapInWorkout(store, item.we, next)
    if (alsoInPlan) await replaceInPlan(store, item.we.exercise_id, next.id)
  }

  async function notAtThisGym(item: WorkoutItem) {
    setMenuFor(null)
    if (gymInfo?.gym) await markUnavailable(store, gymInfo.gym.id, item.we.exercise_id)
    // Straight to picking a replacement; default to fixing the weekly plan too, since the gym won't have it next time either.
    setSwapFor({ item, planDefault: true })
  }

  async function removeFromWorkout(item: WorkoutItem) {
    setMenuFor(null)
    for (const s of item.sets.filter((s) => !s.completed_at)) await store.remove('sets', s.id)
    if (!item.sets.some((s) => s.completed_at)) await store.remove('workout_exercises', item.we.id)
  }

  async function discard() {
    const ok = await confirm({
      title: 'Delete this workout?',
      message: 'All sets in it will be removed. This cannot be undone.',
      confirmLabel: 'Delete workout',
      danger: true,
    })
    if (!ok) return
    try {
      await discardWorkout(store, workout.id)
      navigate('/train')
    } catch (e) {
      setError(`Couldn't delete: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    // Any tap on the logger unlocks audio for the end-of-rest beep (iOS requirement).
    <div className="flex h-full flex-col" onPointerDown={unlockAudio}>
      <header className="flex items-center gap-2 border-b border-border bg-surface px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link
          to={finished ? `/history/${workout.id}` : '/train'}
          aria-label={finished ? 'Back to summary' : 'Leave (workout keeps running)'}
          className="grid size-12 place-items-center text-muted"
        >
          <ChevronLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{workout.name ?? 'Workout'}</p>
          <p className="text-sm tabular-nums text-muted">
            {finished ? 'Finished' : formatElapsed(now - Date.parse(workout.started_at))}
          </p>
        </div>
        {!finished && (
          <button type="button" onClick={() => void finish()} className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
            Finish
          </button>
        )}
      </header>

      <main className="flex-1 space-y-3 overflow-y-auto px-3 py-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {error && <p className="rounded-xl border border-danger/50 p-3 text-sm text-danger">{error}</p>}
        {items.map((item) => (
          <ExerciseCard
            key={item.we.id}
            item={item}
            isActive={item.we.id === activeExerciseId}
            editingId={editingId}
            justDoneId={justDoneId}
            onEdit={(id) => setEditingId(editingId === id ? null : id)}
            offerWarmups={item.we.id === warmupExerciseId}
            onComplete={(s) => void complete(s, item)}
            onSwap={() => setSwapFor({ item, planDefault: false })}
            onMenu={() => setMenuFor(item)}
          />
        ))}

        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-muted"
        >
          <Plus size={20} /> Add exercise
        </button>
        {!finished && (
          <button
            type="button"
            onClick={() => void finish()}
            className="min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-accent-ink"
          >
            Finish workout
          </button>
        )}
        <button type="button" onClick={() => void discard()} className="min-h-12 w-full text-sm text-danger">
          Delete workout
        </button>
      </main>

      <RestTimerBar workoutId={workout.id} />

      {menuFor && (
        <Sheet title={menuFor.exercise?.name ?? 'Exercise'} onClose={() => setMenuFor(null)}>
          <SheetAction onClick={() => { const it = menuFor; setMenuFor(null); setSwapFor({ item: it, planDefault: false }) }}>
            Swap for another exercise
          </SheetAction>
          <SheetAction
            onClick={() => void notAtThisGym(menuFor)}
            detail={`Hide it at ${gymInfo?.gym?.name ?? 'this gym'} and pick a replacement. Undo in More → ${gymInfo?.gym?.name ?? 'Gym'}.`}
          >
            Not at this gym
          </SheetAction>
          <SheetAction danger onClick={() => void removeFromWorkout(menuFor)} detail="Logged sets are kept.">
            Remove from this workout
          </SheetAction>
        </Sheet>
      )}

      {swapFor?.item.exercise && (
        <SwapSheet
          target={swapFor.item.exercise}
          excludeIds={usedIds}
          planOption
          planDefault={swapFor.planDefault}
          onClose={() => setSwapFor(null)}
          onPick={(e, alsoInPlan) => void swap(swapFor.item, e, alsoInPlan)}
        />
      )}

      {picking && (
        <ExercisePicker
          excludeIds={usedIds}
          onClose={() => setPicking(false)}
          onPick={(e) => {
            setPicking(false)
            void addExercise(store, workout.id, { exercise_id: e.id, sets: 3 }, items.length)
          }}
        />
      )}
    </div>
  )
}

function ExerciseCard(props: {
  item: WorkoutItem
  isActive: boolean
  editingId: string | null
  justDoneId: string | null
  onEdit: (id: string) => void
  onComplete: (set: WorkoutSet) => void
  onSwap: () => void
  onMenu: () => void
  offerWarmups: boolean
}) {
  const { item, isActive, editingId, justDoneId, onEdit, onComplete, onSwap, onMenu, offerWarmups } = props
  const { store } = useData()
  const current = currentSetIndex(item.sets)
  const lastTime = formatLastTime(item.last, UNIT)
  let workingNumber = 0

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="flex items-start gap-1 pl-4 pr-1 pt-2">
        <div className="min-w-0 flex-1 pt-1">
          <h2 className="font-semibold">{item.exercise?.name ?? 'Unknown exercise'}</h2>
          <p className="text-sm text-muted">
            {lastTime ? `Last time: ${lastTime} · ` : ''}
            {item.repMin}–{item.repMax} reps
          </p>
          <p className={`text-sm ${item.suggestion.kind === 'increase' ? 'text-accent' : item.suggestion.kind === 'deload' ? 'text-amber-400' : 'text-muted'}`}>
            {item.suggestion.kind === 'increase' ? '↑ ' : item.suggestion.kind === 'deload' ? '↓ ' : ''}
            {item.suggestion.reason}
          </p>
        </div>
        <button type="button" onClick={onSwap} className="flex min-h-12 items-center gap-1 rounded-xl px-2 text-sm text-muted">
          <ArrowLeftRight size={18} /> Swap
        </button>
        <button type="button" onClick={onMenu} aria-label="More options" className="grid size-12 place-items-center text-muted">
          <Ellipsis size={20} />
        </button>
      </div>

      {offerWarmups && <WarmupOffer item={item} />}

      <ul className="mt-2">
        {item.sets.map((set, i) => {
          const label = set.set_type === 'warmup' ? 'W' : String(++workingNumber)
          const isCurrent = isActive && i === current
          const expanded = editingId ? editingId === set.id : isCurrent
          return (
            <li key={set.id} data-current-set={isCurrent} className="border-t border-border">
              {expanded ? (
                <SetEditor
                  set={set}
                  siblings={item.sets}
                  label={label}
                  isCurrent={isCurrent}
                  onComplete={() => onComplete(set)}
                  onDone={() => onEdit(set.id)}
                />
              ) : (
                <SetSummary set={set} label={label} onTap={() => onEdit(set.id)} />
              )}
              {justDoneId === set.id && !expanded && <AfterSetRow set={set} />}
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={() => void addSet(store, item.we.id, item.sets.at(-1))}
        className="flex min-h-12 w-full items-center justify-center gap-1 border-t border-border text-sm text-muted"
      >
        <Plus size={16} /> Add set
      </button>
    </section>
  )
}

function SetSummary({ set, label, onTap }: { set: WorkoutSet; label: string; onTap: () => void }) {
  const done = Boolean(set.completed_at)
  return (
    <button type="button" onClick={onTap} className="flex min-h-12 w-full items-center gap-3 px-4 text-left">
      <span className={`w-6 text-center text-sm ${set.set_type === 'warmup' ? 'text-amber-400' : 'text-muted'}`}>{label}</span>
      <span className={`flex-1 tabular-nums ${done ? '' : 'text-muted'}`}>
        {formatWeight(set.weight_kg, UNIT)} {UNIT} × {set.reps}
        {set.set_type === 'limited' && <span className="ml-2 text-xs text-amber-400">couldn't finish</span>}
        {set.rir !== null && <span className="ml-2 text-xs text-muted">{set.rir >= 4 ? '4+' : set.rir} left</span>}
      </span>
      {done ? <Check size={20} className="text-accent" /> : <span className="size-5 rounded-full border-2 border-border" />}
    </button>
  )
}

function SetEditor(props: {
  set: WorkoutSet
  siblings: WorkoutSet[]
  label: string
  isCurrent: boolean
  onComplete: () => void
  onDone: () => void
}) {
  const { set, siblings, label, isCurrent, onComplete, onDone } = props
  const { store } = useData()
  const weight = displayWeight(set.weight_kg, UNIT, 0.5)
  const done = Boolean(set.completed_at)
  const update = (changes: Partial<WorkoutSet>) => void store.update('sets', set.id, changes)
  // Changing a not-yet-done set carries the new value to the later sets that matched it.
  const change = (field: 'weight_kg' | 'reps', value: number) => {
    const followers = done ? [] : cascadeIds(siblings, set.id, field, set[field])
    for (const id of [set.id, ...followers]) void store.update('sets', id, { [field]: value })
  }

  return (
    <div className={`px-3 py-3 ${isCurrent ? 'bg-surface-2/60' : ''}`}>
      <div className="flex items-center gap-2">
        <span className={`w-6 text-center text-sm ${set.set_type === 'warmup' ? 'text-amber-400' : 'text-muted'}`}>{label}</span>
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Stepper
              label="weight"
              value={weight}
              step={WEIGHT_STEP}
              min={0}
              max={1000}
              format={() => formatWeight(set.weight_kg, UNIT)}
              onChange={(v) => change('weight_kg', toStoredKg(v, UNIT))}
              onTypeValue={(v) => change('weight_kg', toStoredKg(v, UNIT))}
            />
            <span className="text-sm text-muted">{UNIT}</span>
          </div>
          <div className="flex items-center gap-2">
            <Stepper
              label="reps"
              value={set.reps}
              min={0}
              max={100}
              onChange={(reps) => change('reps', reps)}
              onTypeValue={(reps) => change('reps', Math.round(reps))}
            />
            <span className="text-sm text-muted">reps</span>
          </div>
        </div>
        {done ? (
          <button type="button" onClick={onDone} className="h-24 w-20 rounded-2xl border border-border text-sm">
            Done
          </button>
        ) : (
          <button
            type="button"
            aria-label="Log set"
            onClick={onComplete}
            className="grid h-24 w-20 place-items-center rounded-2xl bg-accent text-accent-ink active:scale-95"
          >
            <Check size={36} strokeWidth={3} />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-8">
        <Toggle
          active={set.set_type === 'warmup'}
          onClick={() => update({ set_type: set.set_type === 'warmup' ? 'working' : 'warmup' })}
        >
          Warm-up
        </Toggle>
        {done && (
          <>
            <Toggle
              active={set.set_type === 'limited'}
              onClick={() => update({ set_type: set.set_type === 'limited' ? 'working' : 'limited' })}
            >
              Couldn't finish
            </Toggle>
            <button
              type="button"
              aria-label="Delete set"
              onClick={() => void store.remove('sets', set.id)}
              className="ml-auto grid size-10 place-items-center text-danger"
            >
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Optional details right after logging a set. Ignoring it is fine; it disappears after the next set. */
function AfterSetRow({ set }: { set: WorkoutSet }) {
  const { store } = useData()
  const update = (changes: Partial<WorkoutSet>) => void store.update('sets', set.id, changes)
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pl-13">
      <span className="text-xs text-muted">Reps left in the tank?</span>
      {[0, 1, 2, 3, 4].map((n) => (
        <Toggle key={n} active={set.rir === n} onClick={() => update({ rir: set.rir === n ? null : n })} compact>
          {n === 4 ? '4+' : String(n)}
        </Toggle>
      ))}
      <Toggle
        active={set.set_type === 'limited'}
        onClick={() => update({ set_type: set.set_type === 'limited' ? 'working' : 'limited' })}
      >
        Couldn't finish
      </Toggle>
    </div>
  )
}

function Toggle(props: { active: boolean; onClick: () => void; compact?: boolean; children: React.ReactNode }) {
  const { active, onClick, compact, children } = props
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 rounded-full border text-sm ${compact ? 'min-w-10 px-2' : 'px-3'} ${
        active ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'
      }`}
    >
      {children}
    </button>
  )
}

/** "Add warm-ups" chip with a preview of the ramp, shown until warm-ups exist or a set is logged. */
function WarmupOffer({ item }: { item: WorkoutItem }) {
  const { store } = useData()
  if (item.sets.some((s) => s.set_type === 'warmup' || s.completed_at)) return null
  const firstWorking = item.sets.find((s) => s.set_type !== 'warmup')
  const plan = firstWorking ? warmupPlan(firstWorking.weight_kg, item.exercise?.equipment ?? null) : []
  if (!plan.length) {
    return <p className="px-4 pt-2 text-xs text-muted">Set your working weight to get warm-up suggestions.</p>
  }
  return (
    <div className="px-4 pt-2">
      <button
        type="button"
        onClick={() => void addWarmups(store, item.we.id, plan)}
        className="min-h-11 w-full rounded-xl border border-amber-400/50 px-3 text-left text-sm text-amber-400"
      >
        + Add warm-ups: {plan.map((w) => `${formatWeight(w.weight_kg, UNIT)}×${w.reps}`).join(' · ')}
      </button>
    </div>
  )
}
