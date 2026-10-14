import type { Cursor, Remote, RemoteError, Row } from './remote'
import type { TableName } from './types'

/** Parent column each child must point at, to mimic foreign keys in tests. */
const PARENTS: Partial<Record<TableName, [string, TableName]>> = {
  workout_exercises: ['workout_id', 'workouts'],
  sets: ['workout_exercise_id', 'workout_exercises'],
  plan_template_days: ['template_id', 'plan_templates'],
  plan_template_exercises: ['template_day_id', 'plan_template_days'],
}

/** In-memory stand-in for Supabase used by tests. Sets updated_at like the real triggers do. */
export class FakeRemote implements Remote {
  tables = new Map<TableName, Map<string, Row>>()
  online = true
  reject: ((table: TableName, row: Record<string, unknown>) => RemoteError | null) | null = null
  onUpsert: ((table: TableName) => Promise<void>) | null = null
  private clock = Date.parse('2026-10-14T12:00:00Z')

  table(name: TableName) {
    if (!this.tables.has(name)) this.tables.set(name, new Map())
    return this.tables.get(name)!
  }

  /** Server-side timestamp; `same` reuses the current one to simulate many rows in one transaction. */
  now(same = false) {
    if (!same) this.clock += 1000
    return new Date(this.clock).toISOString()
  }

  async upsert(table: TableName, rows: Record<string, unknown>[]) {
    if (!this.online) return { error: { message: 'TypeError: Failed to fetch' } }
    await this.onUpsert?.(table)
    for (const row of rows) {
      const parent = PARENTS[table]
      if (parent && !this.table(parent[1]).has(row[parent[0]] as string)) {
        return { error: { message: 'foreign key violation', code: '23503' } }
      }
      const rejected = this.reject?.(table, row)
      if (rejected) return { error: rejected }
    }
    const ts = this.now()
    for (const row of rows) this.table(table).set(row.id as string, { ...row, updated_at: ts } as Row)
    return { error: null }
  }

  async pullPage(table: TableName, cursor: Cursor | null, limit: number) {
    if (!this.online) return { data: null, error: { message: 'TypeError: Failed to fetch' } }
    const rows = [...this.table(table).values()]
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id))
      .filter((r) => !cursor || r.updated_at > cursor.updated_at || (r.updated_at === cursor.updated_at && r.id > cursor.id))
      .slice(0, limit)
    return { data: rows, error: null }
  }
}
