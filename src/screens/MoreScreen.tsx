import { useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SyncStatusCard } from '@/components/SyncStatusCard'
import { useData } from '@/data/DataProvider'
import { supabase } from '@/lib/supabase'

export function MoreScreen() {
  const { session } = useAuth()
  const { db, sync } = useData()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    await sync.syncNow() // last chance to upload anything saved offline
    const unsynced = await db.outbox.count()
    if (unsynced > 0 && !confirm(`${unsynced} change(s) haven't uploaded yet and will be lost if you sign out. Sign out anyway?`)) {
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
        <Placeholder phase={5}>Profile, equipment profiles, timer and effort settings</Placeholder>
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
