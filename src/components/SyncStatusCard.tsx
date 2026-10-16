import { useLiveQuery } from 'dexie-react-hooks'
import { useData, useSyncStatus } from '@/data/DataProvider'
import type { TableName } from '@/data/types'
import { useConfirm } from './ConfirmProvider'

const TABLE_LABELS: Partial<Record<TableName, string>> = {
  nutrition_targets: "Today's calorie target", week_plans: 'Week plan', week_plan_days: 'Week plan day', body_measurements: 'Weigh-in',
  food_log_entries: 'Food entry', foods: 'Saved food', saved_meals: 'Saved meal', saved_meal_items: 'Saved meal food',
  workouts: 'Workout', workout_exercises: 'Workout exercise', sets: 'Set', cardio_entries: 'Cardio', water_entries: 'Water', sleep_entries: 'Sleep', profiles: 'Profile / settings',
  goals: 'Goal', equipment_profiles: 'Gym', exercise_unavailable: '"Not at this gym"', plan_templates: 'Weekly plan',
  plan_template_days: 'Weekly plan day', plan_template_exercises: 'Weekly plan exercise',
}

/** What a server error means, in plain words, and what to do about it. */
function explain(error: string | null): string {
  if (!error) return 'Rejected by the server.'
  if (/duplicate key|unique/i.test(error)) return "The server already has this (made on another device or before this phone finished downloading). Discard keeps the server's version; nothing you entered is lost."
  if (/column|schema cache/i.test(error)) return 'The database needs an update (a SQL migration that hasn’t been run). Run it, then tap Try again.'
  if (/foreign key|violates/i.test(error)) return `It points at something the server doesn't have. Discard keeps the server's version. (${error})`
  return error
}

/** Plain-language sync state, so it's always clear whether workouts are safely on the server. */
export function SyncStatusCard() {
  const { db, sync } = useData()
  const status = useSyncStatus()
  const confirm = useConfirm()
  const exerciseCount = useLiveQuery(() => db.exercises.count(), [db])
  const failedEntries = useLiveQuery(() => db.outbox.filter((e) => e.failed).toArray(), [db, status.failed])

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
          {failedEntries?.map((e) => (
            <p key={`${e.table}:${e.id}`} className="mt-2 text-sm">
              <span className="font-medium">{TABLE_LABELS[e.table] ?? e.table}:</span> <span className="text-muted">{explain(e.last_error)}</span>
            </p>
          ))}
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
          <button type="button" onClick={() => void sync.retryFailed()} className="min-h-12 flex-1 rounded-xl border border-border bg-surface-2">
            Try again
          </button>
        )}
        {status.failed > 0 && (
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: 'Discard rejected changes?',
                message: "This phone's copy is replaced with what's on the server.",
                confirmLabel: 'Discard',
                danger: true,
              })
              if (ok) void sync.discardFailed()
            }}
            className="min-h-12 flex-1 rounded-xl border border-danger/50 text-danger"
          >
            Discard
          </button>
        )}
      </div>
    </section>
  )
}
