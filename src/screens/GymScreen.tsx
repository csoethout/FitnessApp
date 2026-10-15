import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'
import { useData } from '@/data/DataProvider'
import { useMainGym } from '@/data/queries'
import { ensureMainGym } from '@/data/setup'
import { restoreAvailable } from '@/data/swap'
import { ALL_EQUIPMENT } from '@/lib/swap'

/** Edit what the gym has. Drives the exercise picker, Swap suggestions and (Phase 5) the planner. */
export function GymScreen() {
  const { db, store } = useData()
  const info = useMainGym()
  const hidden = useLiveQuery(
    async () => (info ? (await db.exercises.bulkGet([...info.unavailableIds])).filter((e) => e !== undefined) : []),
    [db, info],
  )

  if (info === undefined) return null
  const { gym } = info

  if (!gym) {
    return (
      <>
        <Back />
        <p className="mb-4 text-muted">No gym set up yet.</p>
        <button type="button" onClick={() => void ensureMainGym(store)} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-accent-ink">
          Create "Main gym"
        </button>
      </>
    )
  }

  const toggle = (item: string) => {
    const equipment = gym.equipment.includes(item) ? gym.equipment.filter((e) => e !== item) : [...gym.equipment, item]
    void store.update('equipment_profiles', gym.id, { equipment })
  }

  return (
    <>
      <Back />
      <input
        key={gym.updated_at}
        defaultValue={gym.name}
        aria-label="Gym name"
        onBlur={(e) => {
          const name = e.target.value.trim()
          if (name && name !== gym.name) void store.update('equipment_profiles', gym.id, { name })
        }}
        className="mb-1 w-full rounded-lg bg-transparent text-2xl font-semibold outline-none focus:bg-surface-2"
      />
      <p className="mb-4 text-sm text-muted">Swap and the exercise search only suggest what's ticked here.</p>

      <h2 className="mb-2 font-semibold">Equipment</h2>
      <div className="mb-6 flex flex-wrap gap-2">
        {ALL_EQUIPMENT.map((item) => {
          const on = gym.equipment.includes(item)
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item)}
              className={`min-h-11 rounded-full border px-4 capitalize ${on ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`}
            >
              {item === 'body only' ? 'bodyweight' : item}
            </button>
          )
        })}
      </div>

      <h2 className="mb-2 font-semibold">Not at this gym</h2>
      {hidden && hidden.length > 0 ? (
        <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
          {hidden.map((e) => (
            <li key={e!.id} className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-b-0">
              <span className="flex-1">{e!.name}</span>
              <button
                type="button"
                onClick={() => void restoreAvailable(store, gym.id, e!.id)}
                className="min-h-11 rounded-xl border border-border px-3 text-sm"
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nothing hidden. Use ⋯ → "Not at this gym" on an exercise during a workout.</p>
      )}
    </>
  )
}

function Back() {
  return (
    <Link to="/more" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
      <ChevronLeft size={20} /> More
    </Link>
  )
}
