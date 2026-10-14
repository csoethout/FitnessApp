import { describe, expect, it } from 'vitest'
import { looksLikeSupabaseUrl, normalizeSupabaseUrl } from './supabaseUrl'

describe('normalizeSupabaseUrl', () => {
  const good = 'https://abcdefghijklmnop.supabase.co'

  it.each([
    good,
    `${good}/`,
    `${good}/rest/v1/`,
    `${good}/auth/v1`,
    `  ${good}  `,
    `"${good}"`,
    'abcdefghijklmnop.supabase.co',
    'https://supabase.com/dashboard/project/abcdefghijklmnop',
    'https://supabase.com/dashboard/project/abcdefghijklmnop/settings/api',
  ])('turns %s into the project URL', (input) => {
    expect(normalizeSupabaseUrl(input)).toBe(good)
  })

  it('returns undefined for empty input', () => {
    expect(normalizeSupabaseUrl(undefined)).toBeUndefined()
    expect(normalizeSupabaseUrl('')).toBeUndefined()
  })

  it('recognises a valid project URL', () => {
    expect(looksLikeSupabaseUrl(good)).toBe(true)
    expect(looksLikeSupabaseUrl('https://example.com')).toBe(false)
  })
})
