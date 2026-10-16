import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { supabase, supabaseConfigured, supabaseUrlWarning } from '@/lib/supabase'

// Frosted fields over the photo: see-through dark glass, white text, brighter border when focused.
const inputClass =
  'min-h-12 w-full rounded-xl border border-white/25 bg-black/45 px-4 text-base text-white backdrop-blur-md outline-none placeholder:text-white/60 focus:border-white/80'

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
    <div className="relative h-full overflow-hidden bg-black text-white">
      {/* The owner's artwork: the wolf and the title (baked into the image) fill the top; the form sits at the bottom. */}
      <img src="/sign-in.webp" alt="" className="absolute inset-0 size-full object-cover object-[center_35%]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black via-black/75 to-transparent" />
      <h1 className="sr-only">Soev's Strength Lab: sign in</h1>

      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-sm px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {!supabaseConfigured && (
          <p className="mb-4 rounded-xl border border-danger/50 bg-black/70 p-3 text-sm text-danger">
            Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and fill in your
            project URL and anon key.
          </p>
        )}

        {supabaseUrlWarning && (
          <p className="mb-4 rounded-xl border border-danger/50 bg-black/70 p-3 text-sm text-danger">{supabaseUrlWarning}</p>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="rounded-lg bg-black/60 px-3 py-2 text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="min-h-13 w-full rounded-xl bg-neutral-100 text-sm font-semibold tracking-[0.3em] text-black uppercase disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
