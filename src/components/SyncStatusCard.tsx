import { useLiveQuery } from 'dexie-react-hooks'
import { useData, useSyncStatus } from '@/data/DataProvider'

/** Plain-language sync state, so it's always clear whether workouts are safely on the server. */
export function SyncStatusCard() {
  const { db, sync } = useData()
  const status = useSyncStatus()
  const exerciseCount = useLiveQuery(() => db.exercises.count(), [db])

  const headline =
    status.failed > 0
      ? `${status.failed} change${status.failed === 1 ? '' : 's'} rejected by the server`
      : status.pending > 0
        ? `${status.pending} change${status.pending === 1 ? '' : 's'} saved on this phone, waiting to upload`
        : status.lastSyncedAt
          ? 'Everything is backed up'
          : 'Connecting to your account…'
  const detail =
    status.state === 'syncing'
      ? 'Syncing…'
      : status.state === 'offline'
        ? 'Offline. Will upload automatically when you are back online.'
        : status.lastSyncedAt
          ? `Last synced ${new Date(status.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : 'Not synced yet'

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
            status.failed > 0
              ? 'bg-danger'
              : status.pending > 0 || status.state === 'offline' || !status.lastSyncedAt
                ? 'bg-amber-400'
                : 'bg-accent'
          }`}
        />
        <div className="flex-1">
          <p className="font-medium">{headline}</p>
          <p className="text-sm text-muted">{detail}</p>
          <p className="mt-1 text-xs text-muted">Exercise library on this phone: {exerciseCount ?? '…'}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void sync.syncNow()}
          disabled={status.state === 'syncing'}
          className="min-h-12 flex-1 rounded-xl border border-border bg-surface-2 disabled:opacity-50"
        >
          Sync now
        </button>
        {status.failed > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Discard the rejected changes and reload from the server?')) void sync.discardFailed()
            }}
            className="min-h-12 flex-1 rounded-xl border border-danger/50 text-danger"
          >
            Discard rejected
          </button>
        )}
      </div>
    </section>
  )
}
