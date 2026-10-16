import type { LocalDb, OutboxEntry } from './db'
import { isPermanentError, type Cursor, type Remote } from './remote'
import { SYNC_ORDER, type TableName } from './types'

const PUSH_BATCH = 200
const PULL_PAGE = 1000

export type SyncResult = 'ok' | 'offline'

/**
 * Two-way sync between the phone (IndexedDB) and Supabase.
 * - push: send every queued local change (parents before children). The server sets updated_at.
 * - pull: fetch rows changed since the last pull. Rows with a pending local change are skipped,
 *   so an unsynced edit made in the gym is never overwritten; it wins when it is pushed (last write wins).
 */
export class SyncEngine {
  private db: LocalDb
  private remote: Remote

  constructor(db: LocalDb, remote: Remote) {
    this.db = db
    this.remote = remote
  }

  async sync(): Promise<SyncResult> {
    if ((await this.push()) === 'offline') return 'offline'
    return this.pull()
  }

  async push(): Promise<SyncResult> {
    // One snapshot of the queue up front. Reading it table by table let a goal saved mid-push (after "goals" was
    // done) miss this round while its calorie target, saved a moment later, went up without it and was rejected.
    // Changes are queued in order, so a snapshot that holds a child also holds its parent.
    const queued = (await this.db.outbox.toArray()).filter((e) => !e.failed)
    for (const table of SYNC_ORDER) {
      const entries = queued.filter((e) => e.table === table)
      for (let i = 0; i < entries.length; i += PUSH_BATCH) {
        const batch = entries.slice(i, i + PUSH_BATCH)
        if ((await this.pushBatch(table, batch)) === 'offline') return 'offline'
      }
    }
    return 'ok'
  }

  private async pushBatch(table: TableName, entries: OutboxEntry[]): Promise<SyncResult> {
    const rows = await this.db[table].bulkGet(entries.map((e) => e.id))
    const present = entries.filter((_, i) => rows[i] !== undefined)
    const missing = entries.filter((_, i) => rows[i] === undefined)
    if (missing.length) await this.ack(table, missing) // row no longer exists locally; nothing to send

    const payload = rows.filter((r) => r !== undefined).map(toServerRow)
    if (!payload.length) return 'ok'

    const { error } = await this.remote.upsert(table, payload)
    if (!error) {
      await this.ack(table, present)
      return 'ok'
    }
    if (!isPermanentError(error)) {
      await this.bumpAttempts(table, present, error.message)
      return 'offline'
    }
    // The server rejected something in this batch. Send rows one at a time so one bad row can't block the rest.
    for (let i = 0; i < present.length; i++) {
      const single = await this.remote.upsert(table, [payload[i]])
      if (!single.error) await this.ack(table, [present[i]])
      else if (isPermanentError(single.error)) await this.markFailed(table, present[i], single.error.message)
      else return 'offline'
    }
    return 'ok'
  }

  /** Remove outbox entries, unless the row was edited again while the push was in flight. */
  private async ack(table: TableName, entries: OutboxEntry[]) {
    await this.db.transaction('rw', this.db.outbox, async () => {
      for (const e of entries) {
        const current = await this.db.outbox.get([table, e.id])
        if (current && current.version === e.version) await this.db.outbox.delete([table, e.id])
      }
    })
  }

  private async bumpAttempts(table: TableName, entries: OutboxEntry[], message: string) {
    await this.db.outbox.bulkUpdate(
      entries.map((e) => ({ key: [table, e.id] as [TableName, string], changes: { attempts: e.attempts + 1, last_error: message } })),
    )
  }

  private async markFailed(table: TableName, entry: OutboxEntry, message: string) {
    await this.db.outbox.update([table, entry.id], { failed: true, attempts: entry.attempts + 1, last_error: message })
  }

  async pull(): Promise<SyncResult> {
    for (const table of SYNC_ORDER) {
      const key = `cursor:${table}`
      let cursor = ((await this.db.meta.get(key))?.value as Cursor | undefined) ?? null
      for (;;) {
        const { data, error } = await this.remote.pullPage(table, cursor, PULL_PAGE)
        if (error || !data) return 'offline'
        if (!data.length) break
        const last = data[data.length - 1]
        cursor = { updated_at: last.updated_at, id: last.id }
        const nextCursor = cursor
        await this.db.transaction('rw', [this.db[table], this.db.outbox, this.db.meta], async () => {
          const pendingKeys = await this.db.outbox.where('table').equals(table).primaryKeys()
          const pending = new Set(pendingKeys.map((k) => k[1]))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.db[table] as any).bulkPut(data.filter((row) => !pending.has(row.id)))
          await this.db.meta.put({ key, value: nextCursor })
        })
        if (data.length < PULL_PAGE) break
      }
    }
    return 'ok'
  }

  /**
   * Give up on changes the server rejected: drop them and the phone's copy of those rows, then re-download those
   * tables, so the server's version wins (e.g. a second "today's target" made before the first download finished).
   */
  async discardFailed() {
    const failed = await this.db.outbox.filter((e) => e.failed).toArray()
    const tables = [...new Set(failed.map((e) => e.table))]
    await this.db.transaction('rw', [this.db.outbox, this.db.meta, ...tables.map((t) => this.db[t])], async () => {
      await this.db.outbox.bulkDelete(failed.map((e) => [e.table, e.id] as [TableName, string]))
      for (const e of failed) await this.db[e.table].delete(e.id)
      for (const t of tables) await this.db.meta.delete(`cursor:${t}`)
    })
  }

  /** Send rejected changes again (after the cause was fixed on the server, e.g. a missing migration was run). */
  async retryFailed() {
    const failed = await this.db.outbox.filter((e) => e.failed).toArray()
    await this.db.outbox.bulkPut(failed.map((e) => ({ ...e, failed: false })))
  }
}

/** The server owns updated_at (set by default/trigger), which keeps pull cursors free of phone clock skew. */
function toServerRow(row: object): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updated_at, ...rest } = row as Record<string, unknown>
  return rest
}
