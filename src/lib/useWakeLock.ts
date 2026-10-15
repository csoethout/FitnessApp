import { useEffect } from 'react'

/**
 * Keep the screen on while `active` (the logger is open), so the rest timer stays visible and audible.
 * Supported in iOS Safari 16.4+ (home-screen apps from iOS 18.4); silently does nothing elsewhere.
 * The lock is released when the app is hidden, so it's re-requested when it comes back.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock?.release()
      } catch {
        /* denied (e.g. low battery mode) */
      }
    }
    const onVisible = () => void request()
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release()
    }
  }, [active])
}
