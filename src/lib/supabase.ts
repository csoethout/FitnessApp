import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when the Supabase env vars are present. The app shows setup help instead of crashing when they are not. */
export const supabaseConfigured = Boolean(url && anonKey)

// The anon/publishable key is designed to be public; row level security in the database protects the data.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})
