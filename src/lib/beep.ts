// End-of-rest beep using Web Audio.
//
// iOS rules this works around:
// - Audio only starts after the page has *played* something during a tap. Resuming an AudioContext isn't
//   enough, so `unlockAudio()` (called on taps in the logger) plays a one-sample silent buffer.
// - Sounds scheduled far ahead can be dropped, so the beep is played at the moment the timer ends
//   (the screen is kept awake during workouts, so the page is still running then).
// - Web Audio mixes with music (it doesn't pause Spotify), and it is muted by the silent switch.

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

let ctx: AudioContext | null = null
let unlocked = false

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

/** Call from a tap handler. Cheap after the first successful unlock. */
export function unlockAudio() {
  const c = context()
  if (!c) return
  if (c.state !== 'running') void c.resume()
  if (unlocked && c.state === 'running') return
  try {
    const buffer = c.createBuffer(1, 1, 22050)
    const src = c.createBufferSource()
    src.buffer = buffer
    src.connect(c.destination)
    src.start(0)
    unlocked = true
  } catch {
    /* ignore */
  }
}

/** Three short beeps, now. */
export async function beep() {
  const c = context()
  if (!c) return
  try {
    if (c.state !== 'running') await c.resume()
  } catch {
    return
  }
  for (let i = 0; i < 3; i++) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'square' // cuts through gym noise better than a sine
    osc.frequency.value = 1046 // C6
    const t = c.currentTime + 0.05 + i * 0.3
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.2)
  }
}
