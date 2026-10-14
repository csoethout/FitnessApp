import { createClient } from '@supabase/supabase-js'
import { looksLikeSupabaseUrl, normalizeSupabaseUrl } from './supabaseUrl'

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined)
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim().replace(/^["']|["']$/g, '')

/** True when the Supabase env vars are present. The app shows setup help instead of crashing when they are not. */
export const supabaseConfigured = Boolean(url && anonKey)

/** Shown on the sign-in screen when the URL is set but doesn't look like https://<ref>.supabase.co. */
export const supabaseUrlWarning =
  url && !looksLikeSupabaseUrl(url) ? `VITE_SUPABASE_URL looks wrong: "${url}". Expected https://<project-id>.supabase.co` : null

// The anon/publishable key is designed to be public; row level security in the database protects the data.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})
