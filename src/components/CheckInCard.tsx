import { CalendarCheck } from 'lucide-react'
import { useData } from '@/data/DataProvider'
import { recordCheckIn, type PlanState } from '@/data/profile'
import { localDateKey } from '@/lib/body'

/**
 * The 2-week calorie check-in, shown when it's due. Nothing changes until you tap Apply; "Keep as is" also counts
 * as a check-in (the next one is 2 weeks later).
 */
export function CheckInCard({ state }: { state: PlanState }) {
  const { store } = useData()
  const s = state.checkIn.suggestion
  if (!state.checkIn.due || !s || !state.plan) return null
  const record = (change: number) => recordCheckIn(store, { date: localDateKey(new Date()), rate_pct_week: 'ratePct' in s ? Math.round(s.ratePct * 100) / 100 : null, change_kcal: change })

  return (
    <section className="mb-3 rounded-2xl border border-accent/60 bg-accent/10 p-4" aria-label="2-week check-in">
      <h2 className="flex items-center gap-2 font-semibold">
        <CalendarCheck size={18} className="text-accent" /> 2-week check-in
      </h2>
      <p className="mt-1 text-sm">{s.message}</p>
      {s.status === 'adjust' && (
        <>
          <p className="mt-1 text-xs text-muted">
            Daily calories {state.plan.kcal.toLocaleString()} → {(state.plan.kcal + s.change).toLocaleString()} kcal (carbs change; protein and fat stay).
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void record(s.change)} className="min-h-12 flex-1 rounded-xl bg-accent font-semibold text-accent-ink">
              Apply {s.change > 0 ? '+' : '−'}
              {Math.abs(s.change)} kcal
            </button>
            <button type="button" onClick={() => void record(0)} className="min-h-12 flex-1 rounded-xl border border-border">
              Keep as is
            </button>
          </div>
        </>
      )}
      {s.status === 'on-track' && (
        <button type="button" onClick={() => void record(0)} className="mt-3 min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-ink">
          OK
        </button>
      )}
      {s.status === 'not-enough-data' && <p className="mt-1 text-xs text-muted">The check-in waits until there's enough data.</p>}
    </section>
  )
}
