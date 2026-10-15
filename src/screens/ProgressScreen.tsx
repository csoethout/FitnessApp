import { ChevronRight, Trophy } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { BodyView } from '@/components/BodyView'
import { ScreenHeader } from '@/components/ScreenHeader'
import { Sparkline } from '@/components/Sparkline'
import { useProgressData } from '@/data/progress'
import { formatWeight } from '@/lib/logger'
import {
  chooseMetric, prEvents, recentChange, sessionPoints, startOfWeek, weeklyMuscleSets, weeklyVolume, type Metric,
} from '@/lib/progress'
import { formatMetric, metricLabel } from '@/lib/progressFormat'
import { MUSCLE_GROUPS } from '@/lib/training'
import type { WeightUnit } from '@/lib/units'

const UNIT: WeightUnit = 'lb'
const SET_TARGET = 10 // common weekly hard-set target per muscle group

export function ProgressScreen() {
  const [tab, setTab] = useState<'strength' | 'body'>('strength')
  return (
    <>
      <ScreenHeader title="Progress" />
      <div role="tablist" className="mb-4 grid grid-cols-2 rounded-xl bg-surface p-1">
        {(['strength', 'body'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-lg capitalize ${tab === t ? 'bg-surface-2 font-semibold' : 'text-muted'}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'strength' ? <Strength /> : <BodyView />}
    </>
  )
}

function Strength() {
  const data = useProgressData()
  const [now] = useState(() => new Date())
  // null = main lifts only (keeps the list short); otherwise a muscle group label from MUSCLE_GROUPS.
  const [group, setGroup] = useState<string | null>(null)
  const liftsRef = useRef<HTMLElement>(null)

  const model = useMemo(() => {
    if (!data) return null
    const { sessions, exercises, mainLiftIds } = data
    const week = startOfWeek(now)
    const lastWeek = new Date(week)
    lastWeek.setDate(lastWeek.getDate() - 7)
    const volume = weeklyVolume(sessions, now)

    const byExercise = new Map<string, typeof sessions>()
    for (const s of sessions) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s])
    const lifts = [...byExercise.entries()]
      .map(([id, list]) => {
        const points = sessionPoints(list)
        const metric = chooseMetric(points)
        const last = points.at(-1)
        return {
          id,
          name: exercises.get(id)?.name ?? 'Exercise',
          main: mainLiftIds.has(id),
          groups: MUSCLE_GROUPS.filter((g) => g.muscles.some((m) => exercises.get(id)?.primary_muscles.includes(m))).map((g) => g.label),
          metric,
          values: points.map((p) => p[metric]).filter((v): v is number => v !== null),
          current: last?.[metric] ?? null,
          change: recentChange(points, metric, now),
          lastDate: last?.date ?? '',
        }
      })
      .filter((l) => l.current !== null)
      .sort((a, b) => Number(b.main) - Number(a.main) || b.lastDate.localeCompare(a.lastDate))

    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 30)
    // One line per exercise: its most recent record day (e1RM and/or heaviest set), newest first, max 5.
    const latestByExercise = new Map<string, ReturnType<typeof prEvents>>()
    for (const e of prEvents(sessions).filter((e) => new Date(e.date) >= cutoff)) {
      const list = latestByExercise.get(e.exerciseId)
      if (!list) latestByExercise.set(e.exerciseId, [e])
      else if (list[0].date === e.date) list.push(e)
    }
    const prs = [...latestByExercise.values()].slice(0, 5)

    return {
      muscles: weeklyMuscleSets(sessions, week),
      thisWeek: volume.at(-1)!.volumeKg,
      prevWeek: volume.at(-2)!.volumeKg,
      volume,
      lifts,
      prs: prs.map((events) => ({
        exerciseId: events[0].exerciseId,
        date: events[0].date,
        name: exercises.get(events[0].exerciseId)?.name ?? 'Exercise',
        e1rm: events.find((e) => e.kind === 'e1rm')?.value ?? null,
        weight: events.find((e) => e.kind === 'weight')?.value ?? null,
      })),
      empty: sessions.length === 0,
    }
  }, [data, now])

  if (!model) return null
  if (model.empty) {
    return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-muted">Log a workout to see your progress here.</p>
  }

  const shown = group ? model.lifts.filter((l) => l.groups.includes(group)) : model.lifts.filter((l) => l.main)
  const pick = (g: string | null, scroll = false) => {
    setGroup(g)
    requestAnimationFrame(() => {
      // Keep the selected chip visible in the sideways-scrolling row, then (from a bar tap) bring the list into view.
      liftsRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
      if (scroll) liftsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const chip = (active: boolean) =>
    `min-h-10 shrink-0 rounded-full border px-3 text-sm ${active ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`

  return (
    <div className="space-y-4">
      <ThisWeek
        muscles={model.muscles}
        thisWeek={model.thisWeek}
        prevWeek={model.prevWeek}
        selected={group}
        onSelect={(g) => pick(g === group ? null : g, g !== group)}
      />
      <VolumeWeeks weeks={model.volume} />
      <section ref={liftsRef} className="scroll-mt-4">
        <h2 className="mb-2 px-1 font-semibold">Your lifts</h2>
        <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
          <button type="button" aria-pressed={group === null} onClick={() => pick(null)} className={chip(group === null)}>
            ★ Main lifts
          </button>
          {MUSCLE_GROUPS.map((g) => (
            <button key={g.label} type="button" aria-pressed={group === g.label} onClick={() => pick(g.label)} className={chip(group === g.label)}>
              {g.label}
            </button>
          ))}
        </div>
        {shown.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">
            {group ? `No ${group.toLowerCase()} lifts logged yet.` : 'No main lifts logged yet. Mark exercises as main lifts in your week, or pick a muscle group.'}
          </p>
        )}
        <ul className={`overflow-hidden rounded-2xl border border-border bg-surface ${shown.length ? '' : 'hidden'}`}>
          {shown.map((l) => (
            <li key={l.id} className="border-b border-border last:border-b-0">
              <Link to={`/progress/exercise/${l.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {l.main && <span className="mr-1 text-xs text-accent" aria-label="Main lift">★</span>}
                    {l.name}
                  </span>
                  <span className="block text-xs text-muted">
                    {metricLabel(l.metric)}: <span className="text-text">{formatMetric(l.current!, l.metric)}</span>
                    {l.change && <ChangeText delta={l.change.delta} metric={l.metric} since={l.change.since} />}
                  </span>
                </span>
                <Sparkline values={l.values} />
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 px-1 font-semibold">Recent PRs</h2>
        {model.prs.length ? (
          <ul className="space-y-1 rounded-2xl border border-border bg-surface p-4 text-sm">
            {model.prs.map((p) => (
              <li key={p.exerciseId} className="flex items-start gap-2">
                <Trophy size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
                <span className="flex-1">
                  <span className="font-medium">{p.name}</span>
                  <span className="block text-muted">
                    {[
                      p.e1rm !== null && `est. 1-rep max ${formatWeight(p.e1rm, UNIT)} ${UNIT}`,
                      p.weight !== null && `heaviest ${formatWeight(p.weight, UNIT)} ${UNIT}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}{' '}
                    · {new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-muted">No PRs in the last 30 days yet.</p>
        )}
      </section>
    </div>
  )
}

/** Sets per muscle group this week as horizontal bars, with a faint marker at the 10-set target. */
function ThisWeek(props: {
  muscles: { label: string; sets: number }[]
  thisWeek: number
  prevWeek: number
  selected: string | null
  onSelect: (label: string) => void
}) {
  const { muscles, thisWeek, prevWeek, selected, onSelect } = props
  const max = Math.max(SET_TARGET + 4, ...muscles.map((m) => m.sets))
  const pct = prevWeek > 0 ? Math.round(((thisWeek - prevWeek) / prevWeek) * 100) : null
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">This week</h2>
        <p className="text-sm text-muted">
          <span className="font-semibold text-text tabular-nums">{Number(formatWeight(thisWeek, UNIT)).toLocaleString()}</span> {UNIT}
          {pct !== null && <span className={pct >= 0 ? 'text-accent' : ''}> · {pct >= 0 ? '+' : ''}{pct}% vs last week</span>}
        </p>
      </div>
      <p className="mb-1 text-xs text-muted">Working sets per muscle group · line = {SET_TARGET} sets · tap one to see its lifts</p>
      <ul>
        {muscles.map((m) => (
          <li key={m.label}>
            <button
              type="button"
              aria-pressed={selected === m.label}
              aria-label={`${m.label}: ${m.sets} sets this week. Show ${m.label.toLowerCase()} lifts`}
              onClick={() => onSelect(m.label)}
              className={`-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 text-left ${
                selected === m.label ? 'bg-surface-2' : ''
              }`}
            >
              <span className={`w-20 text-sm ${selected === m.label ? 'font-semibold' : ''}`}>{m.label}</span>
              <span className="relative h-3 flex-1" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-chart" style={{ width: `${(m.sets / max) * 100}%` }} />
                <span className="absolute -inset-y-1 w-px bg-muted/60" style={{ left: `${(SET_TARGET / max) * 100}%` }} />
              </span>
              <span className="w-6 text-right text-sm tabular-nums">{m.sets}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Weekly volume, last 8 weeks. Past weeks recede; this week is in the chart color. Tap a column for its value. */
function VolumeWeeks({ weeks }: { weeks: { weekStart: Date; volumeKg: number }[] }) {
  const [selected, setSelected] = useState(weeks.length - 1)
  const max = Math.max(1, ...weeks.map((w) => w.volumeKg))
  const sel = weeks[selected]
  const day = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">Weekly volume</h2>
        <p className="text-sm text-muted">
          {selected === weeks.length - 1 ? 'This week' : `Week of ${day(sel.weekStart)}`}:{' '}
          <span className="font-semibold text-text tabular-nums">{Number(formatWeight(sel.volumeKg, UNIT)).toLocaleString()}</span> {UNIT}
        </p>
      </div>
      <div className="flex h-28 items-end gap-0.5 border-b border-grid">
        {weeks.map((w, i) => (
          <button
            key={w.weekStart.toISOString()}
            type="button"
            onClick={() => setSelected(i)}
            aria-label={`Week of ${day(w.weekStart)}: ${Number(formatWeight(w.volumeKg, UNIT)).toLocaleString()} ${UNIT}`}
            className="flex h-full flex-1 items-end justify-center"
          >
            <span
              className={`w-full max-w-6 rounded-t-[4px] ${i === weeks.length - 1 ? 'bg-chart' : 'bg-muted/40'} ${
                i === selected ? 'outline-2 outline-offset-2 outline-text/60' : ''
              }`}
              style={{ height: `${Math.max(w.volumeKg > 0 ? 3 : 0, (w.volumeKg / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{day(weeks[0].weekStart)}</span>
        <span>This week</span>
      </div>
    </section>
  )
}

function ChangeText({ delta, metric, since }: { delta: number; metric: Metric; since: 'period' | 'start' }) {
  const shown = metric === 'reps' ? Math.round(delta) : Number(formatWeight(Math.abs(delta), UNIT)) * Math.sign(delta)
  if (shown === 0) return <span> · no change</span>
  return (
    <span className={shown > 0 ? 'text-accent' : ''}>
      {' · '}
      {shown > 0 ? '▲ +' : '▼ '}
      {shown}
      {metric === 'reps' ? '' : ` ${UNIT}`} {since === 'period' ? 'in 4 wk' : 'since start'}
    </span>
  )
}
