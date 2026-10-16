import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AreaPicker } from '@/components/AreaPicker'
import { useConfirm } from '@/components/ConfirmProvider'
import { useData } from '@/data/DataProvider'
import { saveFocus } from '@/data/onboarding'
import { useProfile } from '@/data/profile'
import { describeFocus, focusValid, type Focus } from '@/lib/planner/split'

/** Train → Body areas: skip or focus on parts of the body, then rebuild the week (or just save for later). */
export function AreasScreen() {
  const profile = useProfile()
  if (profile === undefined) return null
  return <AreasForm initial={profile?.settings?.trainFocus ?? {}} />
}

function AreasForm({ initial }: { initial: Focus }) {
  const { store } = useData()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [focus, setFocus] = useState<Focus>(initial)
  const [busy, setBusy] = useState(false)
  const valid = focusValid(focus)

  async function save(rebuild: boolean) {
    if (
      rebuild &&
      !(await confirm({
        title: 'Rebuild your week?',
        message: `Your training days stay the same, but their exercises are replaced with a new set built around ${describeFocus(focus)?.toLowerCase() ?? 'every area'}. Past workouts are kept.`,
        confirmLabel: 'Rebuild my week',
      }))
    )
      return
    setBusy(true)
    await saveFocus(store, focus, rebuild)
    navigate('/train')
  }

  return (
    <>
      <Link to="/train" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
        <ChevronLeft size={20} /> Train
      </Link>
      <h1 className="text-2xl font-semibold">Body areas</h1>
      <p className="mb-4 text-sm text-muted">
        Skip an area and your week leaves it out (no legs = upper-body days only). Focus areas come first in a workout and get an extra set.
      </p>
      <AreaPicker value={focus} onChange={setFocus} />
      {!valid && <p className="mt-2 text-sm text-danger">Keep at least one area.</p>}
      <div className="mt-4 space-y-2">
        <button
          type="button"
          disabled={!valid || busy}
          onClick={() => void save(true)}
          className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink disabled:opacity-40"
        >
          Save and rebuild my week
        </button>
        <button type="button" disabled={!valid || busy} onClick={() => void save(false)} className="min-h-12 w-full rounded-xl border border-border disabled:opacity-40">
          Just save (keep my exercises)
        </button>
        <p className="text-xs text-muted">Prefer to change one day by hand? Tap the day on the Train tab.</p>
      </div>
    </>
  )
}
