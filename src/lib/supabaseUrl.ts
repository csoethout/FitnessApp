/**
 * Clean up common copy-paste mistakes in VITE_SUPABASE_URL so they don't break sign-in:
 * surrounding quotes/spaces, a trailing slash, an API path like /rest/v1, or the dashboard URL.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  let url = raw.trim().replace(/^["']|["']$/g, '').trim()

  const dashboard = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i)
  if (dashboard) return `https://${dashboard[1]}.supabase.co`

  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    return new URL(url).origin // drops any path such as /rest/v1/ and trailing slashes
  } catch {
    return undefined
  }
}

/** True when the URL looks like a hosted Supabase project URL. */
export function looksLikeSupabaseUrl(url: string | undefined): boolean {
  return Boolean(url && /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url))
}
