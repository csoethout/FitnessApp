import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { openLocalDb, type LocalDb } from './db'
import { supabaseRemote } from './remote'
import { LocalStore } from './store'
import { SyncEngine } from './sync'
import { FIRST_SYNC_KEY, SyncManager } from './syncManager'

type DataContext = { db: LocalDb; store: LocalStore; sync: SyncManager }

const Ctx = createContext<DataContext | null>(null)

/** Opens the signed-in user's local database and keeps it syncing with Supabase. */
export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id

  const [value, setValue] = useState<DataContext | null>(null)

  // Created inside the effect (not during render) so React's dev double-mount can't use a closed database.
  useEffect(() => {
    if (!userId) return
    const db = openLocalDb(userId)
    const sync = new SyncManager(db, new SyncEngine(db, supabaseRemote(supabase)))
    const store = new LocalStore(db, userId, sync.requestSync)
    // The database is an external resource opened here, so publishing it from the effect is intended.
    // eslint-disable-next-line react/set-state-in-effect
    setValue({ db, store, sync })
    sync.start()
    return () => {
      sync.stop()
      db.close()
      setValue(null)
    }
  }, [userId])

  if (!value) return <div className="grid h-full place-items-center text-muted">Loading…</div>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Local database + write API. Only use inside signed-in screens. */
// eslint-disable-next-line react/only-export-components
export function useData(): DataContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData must be used inside a signed-in DataProvider')
  return ctx
}

// eslint-disable-next-line react/only-export-components
export function useSyncStatus() {
  const { sync } = useData()
  return useSyncExternalStore(sync.subscribe, sync.getStatus)
}

/** True once this device has finished its first full download (see FIRST_SYNC_KEY). undefined while loading. */
// eslint-disable-next-line react/only-export-components
export function useFirstSyncDone() {
  const { db } = useData()
  return useLiveQuery(async () => !!(await db.meta.get(FIRST_SYNC_KEY)), [db])
}
