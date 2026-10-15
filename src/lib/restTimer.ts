import { useSyncExternalStore } from 'react'

export type RestTimerState = { endsAt: number; total: number; workoutId: string } | null

const KEY = 'liftlog.restTimer'
const SOUND_KEY = 'liftlog.restSound'

function load(): RestTimerState {
  try {
    const raw = localStorage.getItem(KEY)
    const s = raw ? (JSON.parse(raw) as RestTimerState) : null
    // Forget timers that ended more than a minute ago (e.g. app reopened much later).
    return s && s.endsAt > Date.now() - 60_000 ? s : null
  } catch {
    return null
  }
}

/**
 * Rest timer stored as an end time (not a countdown), so it stays correct if the app is switched away,
 * the screen locks, or the page reloads. Saved in localStorage; one timer at a time.
 */
class RestTimer {
  private state: RestTimerState = load()
  private listeners = new Set<() => void>()
  private soundOn = (() => {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off'
    } catch {
      return true
    }
  })()

  start(seconds: number, workoutId: string) {
    this.set({ endsAt: Date.now() + seconds * 1000, total: seconds, workoutId })
  }
  /** −15 / +15 buttons. */
  adjust(deltaSeconds: number) {
    if (!this.state) return
    const endsAt = Math.max(Date.now(), this.state.endsAt + deltaSeconds * 1000)
    this.set({ ...this.state, endsAt, total: Math.max(1, this.state.total + deltaSeconds) })
  }
  /** 1 / 2 / 3 min buttons: restart with that length. */
  restart(seconds: number) {
    if (this.state) this.start(seconds, this.state.workoutId)
  }
  skip() {
    this.set(null)
  }
  toggleSound() {
    this.soundOn = !this.soundOn
    try {
      localStorage.setItem(SOUND_KEY, this.soundOn ? 'on' : 'off')
    } catch {
      /* private mode: setting just won't persist */
    }
    this.listeners.forEach((l) => l())
  }
  get sound() {
    return this.soundOn
  }

  private set(s: RestTimerState) {
    this.state = s
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s))
      else localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    this.listeners.forEach((l) => l())
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  get = () => this.state
  getSound = () => this.soundOn
}

export const restTimer = new RestTimer()

export function useRestTimer() {
  const state = useSyncExternalStore(restTimer.subscribe, restTimer.get)
  const sound = useSyncExternalStore(restTimer.subscribe, restTimer.getSound)
  return { state, sound }
}
