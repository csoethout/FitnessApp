import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { supabase, supabaseConfigured } from '@/lib/supabase'

const inputClass =
  'min-h-12 w-full rounded-xl border border-border bg-surface-2 px-4 text-base outline-none focus:border-accent'

/**
 * Invite-only: there is deliberately no sign-up form. Accounts are created in the Supabase dashboard.
 * Inputs use text-base (16px) so iOS Safari does not zoom in when they are focused.
 */
export function SignInScreen() {
  const { session } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="mx-auto flex h-full max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-3xl font-semibold">Lift Log</h1>
      <p className="mb-8 text-muted">Sign in to continue</p>

      {!supabaseConfigured && (
        <p className="mb-4 rounded-xl border border-danger/50 p-3 text-sm text-danger">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and fill in your
          project URL and anon key.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-ink disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
