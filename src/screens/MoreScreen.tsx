import { ChevronRight, Dumbbell } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { useConfirm } from '@/components/ConfirmProvider'
import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SyncStatusCard } from '@/components/SyncStatusCard'
import { useData } from '@/data/DataProvider'
import { useMainGym } from '@/data/queries'
import { supabase } from '@/lib/supabase'

export function MoreScreen() {
  const { session } = useAuth()
  const { db, sync } = useData()
  const [signingOut, setSigningOut] = useState(false)
  const confirm = useConfirm()
  const gymInfo = useMainGym()

  async function signOut() {
    setSigningOut(true)
    await sync.syncNow() // last chance to upload anything saved offline
    const unsynced = await db.outbox.count()
    if (
      unsynced > 0 &&
      !(await confirm({
        title: 'Sign out anyway?',
        message: `${unsynced} change(s) haven't uploaded yet and will be lost.`,
        confirmLabel: 'Sign out',
        danger: true,
      }))
    ) {
      setSigningOut(false)
      return
    }
    await db.delete() // remove this account's data from the phone
    await supabase.auth.signOut()
  }

  return (
    <>
      <ScreenHeader title="More" subtitle={session?.user.email} />
      <div className="space-y-3">
        <SyncStatusCard />
        <Link to="/more/gym" className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4">
          <Dumbbell size={20} className="text-muted" aria-hidden />
          <span className="flex-1">
            {gymInfo?.gym?.name ?? 'Gym'}
            <span className="block text-xs text-muted">
              Equipment{gymInfo?.unavailableIds.size ? ` · ${gymInfo.unavailableIds.size} hidden exercise(s)` : ''}
            </span>
          </span>
          <ChevronRight size={20} className="text-muted" aria-hidden />
        </Link>
        <Placeholder phase={5}>Profile, timer and effort settings</Placeholder>
        <Placeholder phase={6}>Export all data as CSV</Placeholder>
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
          className="min-h-12 w-full rounded-xl border border-border bg-surface text-danger disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <p className="pt-4 text-center text-xs text-muted">
          Not medical advice. Talk to a doctor or physical therapist before changing your training or diet.
        </p>
      </div>
    </>
  )
}
