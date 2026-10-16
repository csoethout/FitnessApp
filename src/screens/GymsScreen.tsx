import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Sheet } from '@/components/Sheet'
import { useData } from '@/data/DataProvider'
import { useGyms } from '@/data/queries'
import { GYM_PRESETS } from '@/lib/gyms'

/** Quick starting points for a new gym; you can tick/untick equipment afterwards. */
const PRESETS = [GYM_PRESETS[1], GYM_PRESETS[2], GYM_PRESETS[3], GYM_PRESETS[0]] // most common extra gyms first

/** Your gyms: the usual one, plus others (hotel, home…) for Plan my week's Away days. */
export function GymsScreen() {
  const gyms = useGyms()
  const [adding, setAdding] = useState(false)
  if (!gyms) return null
  return (
    <>
      <Link to="/more" className="-ml-2 mb-2 inline-flex min-h-12 items-center text-muted">
        <ChevronLeft size={20} /> More
      </Link>
      <h1 className="mb-1 text-2xl font-semibold">Gyms</h1>
      <p className="mb-4 text-sm text-muted">What each place has. On Plan my week, mark a day Away and pick where you'll be.</p>
      <ul className="space-y-2">
        {gyms.map((g) => (
          <li key={g.id}>
            <Link to={`/more/gym/${g.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {g.name}
                  {g.is_default && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">Usual</span>}
                </span>
                <span className="block truncate text-xs text-muted">{g.equipment.map((e) => (e === 'body only' ? 'bodyweight' : e)).join(', ') || 'No equipment'}</span>
              </span>
              <ChevronRight size={20} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setAdding(true)} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted">
        <Plus size={18} /> Add a gym
      </button>
      {adding && <AddGymSheet onClose={() => setAdding(false)} />}
    </>
  )
}

function AddGymSheet({ onClose }: { onClose: () => void }) {
  const { store } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [preset, setPreset] = useState(0)
  async function create() {
    const gym = await store.insert('equipment_profiles', { name: name.trim() || PRESETS[preset].label, equipment: PRESETS[preset].equipment, is_default: false })
    navigate(`/more/gym/${gym.id}`)
  }
  return (
    <Sheet title="Add a gym" onClose={onClose}>
      <div className="space-y-3 pb-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Name (e.g. ${PRESETS[preset].label})`}
          aria-label="Gym name"
          className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-base outline-none focus:border-accent"
        />
        <p className="text-sm text-muted">Start from</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={preset === i}
              onClick={() => setPreset(i)}
              className={`min-h-12 rounded-xl border text-sm ${preset === i ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void create()} className="min-h-14 w-full rounded-xl bg-accent text-lg font-semibold text-accent-ink">
          Add gym
        </button>
      </div>
    </Sheet>
  )
}
