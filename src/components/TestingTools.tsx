import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { addSampleWeighIns, addSampleWorkouts, deleteAllFoodLog, deleteAllWeighIns, deleteAllWorkouts } from '@/data/sample'
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
                title: 'Add sample data?',
                message: 'Adds 6 weeks of made-up workouts (following your weekly plan, slowly getting stronger) and weigh-ins (slowly trending down).',
                confirmLabel: 'Add sample data',
              })
              if (!ok) return ''
              const w = await addSampleWeighIns(store)
              const n = await addSampleWorkouts(store).catch((e: Error) => {
                throw new Error(`Added ${w} weigh-ins. Workouts: ${e.message}`)
              })
              return `Added ${n} workouts and ${w} weigh-ins. See Progress and Train → History.`
            })
          }
          className="min-h-12 w-full rounded-xl border border-border bg-surface-2 disabled:opacity-50"
        >
          Add 6 weeks of sample data
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const ok = await confirm({
                title: 'Delete ALL logged data?',
                message:
                  'Every workout, weigh-in and food log entry, real or sample, is removed from this phone and from your account. Your weekly plan, gym, saved foods and targets are kept. This cannot be undone.',
                confirmLabel: 'Delete everything logged',
                danger: true,
              })
              if (!ok) return ''
              const n = await deleteAllWorkouts(store)
              const w = await deleteAllWeighIns(store)
              const f = await deleteAllFoodLog(store)
              restTimer.skip()
              return `Deleted ${n} workouts, ${w} weigh-ins and ${f} food entries.`
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
