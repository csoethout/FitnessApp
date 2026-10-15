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

// ---- Sound -------------------------------------------------------------------------------------------------
// iOS only allows audio that was "unlocked" by a tap, and pauses it when the screen locks. So the ✓ tap unlocks
// audio and we schedule the beep in advance on the audio clock; keeping the screen awake (wake lock) lets it play.
// Note: the iPhone silent switch mutes web audio.

let ctx: AudioContext | null = null
let scheduled: OscillatorNode[] = []

export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* no audio support */
  }
}

/** (Re)schedule three short beeps at `endsAt`. Pass null to cancel. */
export function scheduleBeep(endsAt: number | null) {
  scheduled.forEach((o) => {
    try {
      o.stop()
    } catch {
      /* already stopped */
    }
  })
  scheduled = []
  if (!ctx || endsAt === null) return
  const delay = (endsAt - Date.now()) / 1000
  if (delay < 0) return
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.25
    osc.connect(gain).connect(ctx.destination)
    const t = ctx.currentTime + delay + i * 0.35
    osc.start(t)
    osc.stop(t + 0.18)
    scheduled.push(osc)
  }
}
