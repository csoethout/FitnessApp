import type { SupabaseClient } from '@supabase/supabase-js'
import type { TableName } from './types'

export type Row = Record<string, unknown> & { id: string; updated_at: string }
export type Cursor = { updated_at: string; id: string }
export type RemoteError = { message: string; code?: string }

/** The two things sync needs from the server. Kept as an interface so tests can use an in-memory fake. */
export interface Remote {
  upsert(table: TableName, rows: Record<string, unknown>[]): Promise<{ error: RemoteError | null }>
  /** Rows changed after `cursor`, ordered by (updated_at, id). Includes soft-deleted rows. */
  pullPage(table: TableName, cursor: Cursor | null, limit: number): Promise<{ data: Row[] | null; error: RemoteError | null }>
}

/**
 * Postgres error classes that will fail the same way on every retry:
 * 22 = bad data, 23 = constraint violation, 42 = permission/RLS or schema problem.
 * Anything else (no code = network failure, 5xx, timeouts) is treated as temporary.
 */
export function isPermanentError(error: RemoteError): boolean {
  return /^(22|23|42)/.test(error.code ?? '')
}

export function supabaseRemote(client: SupabaseClient): Remote {
  return {
    async upsert(table, rows) {
      const { error } = await client.from(table).upsert(rows, { onConflict: 'id' })
      return { error }
    },
    async pullPage(table, cursor, limit) {
      let query = client.from(table).select('*').order('updated_at').order('id').limit(limit)
      if (cursor) {
        // Keyset pagination: strictly after (updated_at, id). Values are quoted because timestamps contain ':' and '+'.
        query = query.or(
          `updated_at.gt."${cursor.updated_at}",and(updated_at.eq."${cursor.updated_at}",id.gt.${cursor.id})`,
        )
      }
      const { data, error } = await query
      return { data: data as Row[] | null, error }
    },
  }
}
