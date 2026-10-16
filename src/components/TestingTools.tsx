import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { fillDemoAccount } from '@/data/demo'
import { deleteAllCardio, deleteAllFoodLog, deleteAllWaterAndSleep, deleteAllWeighIns, deleteAllWorkouts } from '@/data/sample'
import { restTimer } from '@/lib/restTimer'
import { useConfirm } from './ConfirmProvider'

/** TESTING TOOL: remove before other people use the app (see Backlog in CLAUDE.md). */
export function TestingTools() {
  const { store } = useData()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setMessage(null)
    try {
      setMessage(await action())
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-dashed border-amber-400/50 p-4">
      <p className="font-medium">Testing tools</p>
      <p className="text-sm text-muted">For trying the app out. These will be removed later.</p>
      <div className="mt-3 space-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const ok = await confirm({
                title: 'Fill this account with demo data?',
                message:
                  'For a demo account only: 6 weeks of workouts, weigh-ins and walks, 2 weeks of food, saved meals, a nutrition plan with a check-in due, a hotel gym and next week planned. Refused if the account already has its own workouts or food.',
                confirmLabel: 'Fill demo data',
              })
              if (!ok) return ''
              return fillDemoAccount(store)
            })
          }
          className="min-h-12 w-full rounded-xl border border-border bg-surface-2 disabled:opacity-50"
        >
          Fill demo account
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const ok = await confirm({
                title: 'Delete ALL logged data?',
                message:
                  'Every workout, weigh-in, cardio, water, sleep and food log entry, real or sample, is removed from this phone and from your account. Your weekly plan, gyms, saved foods and meals, and targets are kept. This cannot be undone.',
                confirmLabel: 'Delete everything logged',
                danger: true,
              })
              if (!ok) return ''
              const n = await deleteAllWorkouts(store)
              const w = await deleteAllWeighIns(store)
              const f = await deleteAllFoodLog(store)
              const c = await deleteAllCardio(store)
              const ws = await deleteAllWaterAndSleep(store)
              restTimer.skip()
              return `Deleted ${n} workouts, ${w} weigh-ins, ${f} food entries ${c} cardio entries and ${ws} water/sleep entries.`
            })
          }
          className="min-h-12 w-full rounded-xl border border-danger/50 text-danger disabled:opacity-50"
        >
          Delete all logged data
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
    </section>
  )
}
