import type { LocalDb } from './db'
import type { SyncEngine } from './sync'

export type SyncStatus = {
  state: 'idle' | 'syncing' | 'offline'
  pending: number // local changes not yet on the server
  failed: number // changes the server rejected (shown so nothing is silently lost)
  lastSyncedAt: string | null
}

export const FIRST_SYNC_KEY = 'firstSyncDone'
const DEBOUNCE_MS = 800
const INTERVAL_MS = 60_000

/**
 * Decides when to sync: shortly after each local write, when the app comes back to the foreground,
 * when the phone reconnects, and every minute while the app is open. Only one sync runs at a time.
 * (iOS doesn't allow background sync for web apps, so syncing happens while the app is open.)
 */
export class SyncManager {
  private status: SyncStatus = { state: 'idle', pending: 0, failed: 0, lastSyncedAt: null }
  private listeners = new Set<() => void>()
  private running: Promise<void> | null = null
  private again = false
  private debounce: ReturnType<typeof setTimeout> | undefined
  private interval: ReturnType<typeof setInterval> | undefined
  private db: LocalDb
  private engine: SyncEngine

  constructor(db: LocalDb, engine: SyncEngine) {
    this.db = db
    this.engine = engine
  }

  start() {
    window.addEventListener('online', this.onWake)
    document.addEventListener('visibilitychange', this.onWake)
    this.interval = setInterval(this.onWake, INTERVAL_MS)
    void this.syncNow()
  }

  stop() {
    window.removeEventListener('online', this.onWake)
    document.removeEventListener('visibilitychange', this.onWake)
    clearInterval(this.interval)
    clearTimeout(this.debounce)
    this.listeners.clear()
  }

  /** Call after every local write. */
  requestSync = () => {
    // setTimeout runs outside any Dexie transaction the write may be part of.
    setTimeout(() => void this.refreshCounts(), 0)
    clearTimeout(this.debounce)
    this.debounce = setTimeout(() => void this.syncNow(), DEBOUNCE_MS)
  }

  private onWake = () => {
    if (document.visibilityState === 'visible') void this.syncNow()
  }

  async syncNow(): Promise<void> {
    if (this.running) {
      this.again = true // a change arrived mid-sync; run once more afterwards
      return this.running
    }
    this.running = (async () => {
      do {
        this.again = false
        this.set({ state: 'syncing' })
        const result = navigator.onLine ? await this.engine.sync().catch(() => 'offline' as const) : 'offline'
        await this.refreshCounts()
        // Remembered per device: until the first full download is done, automatic writes (today's target, a new
        // week plan) wait, so a fresh install can't create duplicates of rows the server already has.
        if (result === 'ok' && !(await this.db.meta.get(FIRST_SYNC_KEY))) await this.db.meta.put({ key: FIRST_SYNC_KEY, value: new Date().toISOString() })
        this.set(result === 'ok' ? { state: 'idle', lastSyncedAt: new Date().toISOString() } : { state: 'offline' })
      } while (this.again)
    })()
    try {
      await this.running
    } finally {
      this.running = null
    }
  }

  async discardFailed() {
    await this.engine.discardFailed()
    await this.syncNow()
  }

  async retryFailed() {
    await this.engine.retryFailed()
    await this.syncNow()
  }

  private async refreshCounts() {
    const all = await this.db.outbox.toArray()
    const failed = all.filter((e) => e.failed).length
    this.set({ pending: all.length - failed, failed })
  }

  private set(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach((l) => l())
  }

  // For React's useSyncExternalStore.
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getStatus = () => this.status
}
