import { useState } from 'react'
import { useData } from '@/data/DataProvider'
import { addSampleWorkouts, deleteAllWorkouts } from '@/data/sample'
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
                title: 'Add sample workouts?',
                message: 'Adds 6 weeks of made-up workouts that follow your weekly plan, with slowly rising weights.',
                confirmLabel: 'Add sample data',
              })
              if (!ok) return ''
              const n = await addSampleWorkouts(store)
              return `Added ${n} sample workouts. See Progress and Train → History.`
            })
          }
          className="min-h-12 w-full rounded-xl border border-border bg-surface-2 disabled:opacity-50"
        >
          Add 6 weeks of sample workouts
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const ok = await confirm({
                title: 'Delete ALL workouts?',
                message:
                  'Every workout, real or sample, is removed from this phone and from your account. Your weekly plan and gym settings are kept. This cannot be undone.',
                confirmLabel: 'Delete all workouts',
                danger: true,
              })
              if (!ok) return ''
              const n = await deleteAllWorkouts(store)
              restTimer.skip()
              return `Deleted ${n} workouts.`
            })
          }
          className="min-h-12 w-full rounded-xl border border-danger/50 text-danger disabled:opacity-50"
        >
          Delete all workouts
        </button>
      </div>
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
    </section>
  )
}
