import type { LocalDb } from './db'
import { OWNER_COLUMN, type TableName, type Tables } from './types'

type NewRow<T extends TableName> = Omit<Tables[T], 'id' | 'user_id' | 'owner_id' | 'created_at' | 'updated_at' | 'deleted_at'> & {
  id?: string
}

/**
 * The only way the app writes data. Every write lands in IndexedDB immediately (works offline)
 * and is queued in the outbox for the next sync.
 */
export class LocalStore {
  readonly db: LocalDb
  readonly userId: string
  private onWrite: () => void

  constructor(db: LocalDb, userId: string, onWrite: () => void = () => {}) {
    this.db = db
    this.userId = userId
    this.onWrite = onWrite
  }

  async insert<T extends TableName>(table: T, fields: NewRow<T>): Promise<Tables[T]> {
    const now = new Date().toISOString()
    const ownerColumn = OWNER_COLUMN[table]
    const row = {
      ...fields,
      id: fields.id ?? crypto.randomUUID(),
      [ownerColumn]: this.userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as unknown as Tables[T]
    await this.write(table, row)
    return row
  }

  async update<T extends TableName>(table: T, id: string, changes: Partial<Tables[T]>): Promise<Tables[T]> {
    const existing = (await this.db[table].get(id)) as Tables[T] | undefined
    if (!existing) throw new Error(`${table} ${id} not found`)
    const row = { ...existing, ...changes, id, updated_at: new Date().toISOString() } as Tables[T]
    await this.write(table, row)
    return row
  }

  /** Soft delete: the row is kept with deleted_at set, so the deletion syncs to other devices. */
  remove<T extends TableName>(table: T, id: string): Promise<Tables[T]> {
    return this.update(table, id, { deleted_at: new Date().toISOString() } as Partial<Tables[T]>)
  }

  private async write<T extends TableName>(table: T, row: Tables[T]) {
    const { id, updated_at } = row as { id: string; updated_at: string }
    await this.db.transaction('rw', this.db[table], this.db.outbox, async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.db[table] as any).put(row)
      await this.db.outbox.put({
        table,
        id,
        version: crypto.randomUUID(), // unique per write, so two edits in the same millisecond are still distinct
        queued_at: updated_at,
        attempts: 0,
        failed: false,
        last_error: null,
      })
    })
    this.onWrite()
  }
}
