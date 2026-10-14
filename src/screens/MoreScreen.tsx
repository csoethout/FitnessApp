import { useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { Placeholder } from '@/components/Placeholder'
import { ScreenHeader } from '@/components/ScreenHeader'
import { supabase } from '@/lib/supabase'

export function MoreScreen() {
  const { session } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  return (
    <>
      <ScreenHeader title="More" subtitle={session?.user.email} />
      <div className="space-y-3">
        <Placeholder phase={5}>Profile, equipment profiles, timer and effort settings</Placeholder>
        <Placeholder phase={6}>Export all data as CSV</Placeholder>
        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true)
            await supabase.auth.signOut()
          }}
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
