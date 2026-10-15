import { Volume2, VolumeX } from 'lucide-react'
import { useEffect } from 'react'
import { formatElapsed } from '@/lib/logger'
import { restTimer, scheduleBeep, useRestTimer } from '@/lib/restTimer'
import { useNow } from '@/lib/useNow'

/**
 * Rest countdown pinned to the bottom of the logger (thumb zone). Starts automatically after each set.
 * −15/+15 nudge it; 1/2/3 min restart it; Skip hides it. Turns green with a beep when rest is over.
 */
export function RestTimerBar({ workoutId }: { workoutId: string }) {
  const { state, sound } = useRestTimer()
  const now = useNow(250)
  const mine = state?.workoutId === workoutId ? state : null
  // `now` can be up to one tick old, so cap at the full length (never show 1:01 for a 1:00 rest).
  const remaining = mine ? Math.min(mine.endsAt - now, mine.total * 1000) : 0
  const over = Boolean(mine) && remaining <= 0

  // (Re)schedule the end-of-rest beep whenever the timer or the sound setting changes.
  useEffect(() => {
    scheduleBeep(mine && sound ? mine.endsAt : null)
  }, [mine, sound])

  // Clear a finished timer after a minute so it doesn't linger.
  useEffect(() => {
    if (over && remaining < -60_000) restTimer.skip()
  }, [over, remaining])

  if (!mine) return null
  const progress = Math.min(1, Math.max(0, 1 - remaining / (mine.total * 1000)))

  return (
    <div
      role="timer"
      aria-live="off"
      className={`border-t px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${
        over ? 'border-accent bg-accent text-accent-ink' : 'border-border bg-surface'
      }`}
    >
      {!over && (
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="min-w-24">
          <p className={`text-xs ${over ? '' : 'text-muted'}`}>{over ? 'Rest over' : 'Rest'}</p>
          <p className="text-2xl font-semibold tabular-nums">{over ? 'Go!' : formatElapsed(remaining + 999)}</p>
        </div>
        {!over && (
          <>
            <TimerButton onClick={() => restTimer.adjust(-15)} label="15 seconds less">−15</TimerButton>
            <TimerButton onClick={() => restTimer.adjust(15)} label="15 seconds more">+15</TimerButton>
          </>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => restTimer.toggleSound()}
          aria-label={sound ? 'Turn rest sound off' : 'Turn rest sound on'}
          className="grid size-12 place-items-center"
        >
          {sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
        <button
          type="button"
          onClick={() => restTimer.skip()}
          className={`min-h-12 rounded-xl px-4 font-semibold ${over ? 'bg-accent-ink text-accent' : 'bg-surface-2'}`}
        >
          {over ? 'Dismiss' : 'Skip'}
        </button>
      </div>
      {!over && (
        <div className="mt-2 flex gap-2">
          {[60, 120, 180].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => restTimer.restart(s)}
              className={`min-h-10 flex-1 rounded-full border text-sm ${
                mine.total === s ? 'border-accent text-accent' : 'border-border text-muted'
              }`}
            >
              {s / 60} min
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TimerButton({ onClick, label, children }: { onClick: () => void; label: string; children: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="min-h-12 min-w-12 rounded-xl bg-surface-2 px-2 font-semibold">
      {children}
    </button>
  )
}
