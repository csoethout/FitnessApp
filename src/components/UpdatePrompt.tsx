import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY_MS = 60 * 60 * 1000 // home-screen apps rarely look for updates on their own

/**
 * Registers the service worker (offline app shell). When a new version has been downloaded it waits for you:
 * a small bar offers "Reload", so an update never interrupts you mid-workout. Your data isn't affected.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), CHECK_EVERY_MS)
    },
  })
  if (!needRefresh) return null
  return (
    <div role="status" className="mb-3 flex items-center gap-2 rounded-2xl border border-accent/60 bg-accent/10 p-3 text-sm">
      <RefreshCw size={16} className="shrink-0 text-accent" />
      <span className="flex-1">A new version of the app is ready.</span>
      <button type="button" onClick={() => setNeedRefresh(false)} className="min-h-10 px-2 text-muted">
        Later
      </button>
      <button type="button" onClick={() => void updateServiceWorker(true)} className="min-h-10 rounded-lg bg-accent px-3 font-semibold text-accent-ink">
        Reload
      </button>
    </div>
  )
}
