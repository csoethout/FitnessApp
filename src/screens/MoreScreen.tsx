import { ChevronRight, Dumbbell } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { useConfirm } from '@/components/ConfirmProvider'
import { ExportCard } from '@/components/ExportCard'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SyncStatusCard } from '@/components/SyncStatusCard'
import { TestingTools } from '@/components/TestingTools'
import { useData } from '@/data/DataProvider'
import { saveAppSetting, useAppSettings, type AppSettings } from '@/data/profile'
import { useMainGym } from '@/data/queries'
import { supabase } from '@/lib/supabase'

export function MoreScreen() {
  const { session } = useAuth()
  const { db, sync } = useData()
  const [signingOut, setSigningOut] = useState(false)
  const confirm = useConfirm()
  const gymInfo = useMainGym()

  async function signOut() {
    setSigningOut(true)
    await sync.syncNow() // last chance to upload anything saved offline
    const unsynced = await db.outbox.count()
    if (
      unsynced > 0 &&
      !(await confirm({
        title: 'Sign out anyway?',
        message: `${unsynced} change(s) haven't uploaded yet and will be lost.`,
        confirmLabel: 'Sign out',
        danger: true,
      }))
    ) {
      setSigningOut(false)
      return
    }
    await db.delete() // remove this account's data from the phone
    await supabase.auth.signOut()
  }

  return (
    <>
      <ScreenHeader title="More" subtitle={session?.user.email} />
      <div className="space-y-3">
        <SyncStatusCard />
        <Link to="/more/gyms" className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4">
          <Dumbbell size={20} className="text-muted" aria-hidden />
          <span className="flex-1">
            Gyms
            <span className="block text-xs text-muted">
              {gymInfo?.gym?.name ?? 'Main gym'}
              {gymInfo?.unavailableIds.size ? ` · ${gymInfo.unavailableIds.size} hidden exercise(s)` : ''} · add a hotel or home gym
            </span>
          </span>
          <ChevronRight size={20} className="text-muted" aria-hidden />
        </Link>
        <WorkoutSettings />
        <ExportCard />
        <TestingTools />
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
          className="min-h-12 w-full rounded-xl border border-border bg-surface text-danger disabled:opacity-50"
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        <p className="pt-4 text-center text-xs text-muted">
          Not medical advice. Talk to a doctor or physical therapist before changing your training or diet.
        </p>
      </div>
    </>
  )
}

/** Logger preferences: rest timer and the "reps left in the tank" question. */
function WorkoutSettings() {
  const settings = useAppSettings()
  if (!settings) return null
  return (
    <section className="divide-y divide-border rounded-2xl border border-border bg-surface" aria-label="Workout settings">
      <h2 className="px-4 pt-3 pb-2 text-sm font-semibold text-muted">Workout</h2>
      <SettingRow label="Rest timer" detail="Starts after each set (3 / 2 / 1 min by exercise)" initial={settings.restTimer} save={(v) => ({ restTimer: v })} />
      <SettingRow label='Ask "reps left in the tank?"' detail="Optional effort row after each set" initial={settings.askEffort} save={(v) => ({ askEffort: v })} />
    </section>
  )
}

/** A switch that flips instantly and saves in the background. */
function SettingRow(props: { label: string; detail: string; initial: boolean; save: (v: boolean) => Partial<AppSettings> }) {
  const { store } = useData()
  const [on, setOn] = useState(props.initial)
  return (
    <label className="flex min-h-14 items-center gap-3 px-4 py-2">
      <span className="flex-1">
        {props.label}
        <span className="block text-xs text-muted">{props.detail}</span>
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setOn(e.target.checked)
          void saveAppSetting(store, props.save(e.target.checked))
        }}
        className="size-6 accent-accent"
      />
    </label>
  )
}
