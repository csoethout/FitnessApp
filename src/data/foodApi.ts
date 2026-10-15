import { fromUsda, type FoundFood, type UsdaFood } from '@/lib/foodSearch'

// Searches go straight from the phone to the free public APIs (see CLAUDE.md → Food search).
// The USDA key is a free read-only key and ends up in the app bundle (accepted). Without one we use
// USDA's shared DEMO_KEY, which works but runs out quickly (about 30 searches an hour).
const USDA_KEY = (import.meta.env.VITE_USDA_API_KEY as string | undefined)?.trim() || 'DEMO_KEY'
export const usingDemoKey = USDA_KEY === 'DEMO_KEY'

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (res.status === 429) throw new Error('Too many searches right now, try again in a minute')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

/** Abort when the caller aborts or after `ms` (written out by hand: AbortSignal.any needs iOS 17.4+). */
function withTimeout(signal: AbortSignal, ms: number): AbortSignal {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('Timed out')), ms)
  const stop = () => ctrl.abort(signal.reason)
  if (signal.aborted) stop()
  else signal.addEventListener('abort', stop, { once: true })
  ctrl.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  return ctrl.signal
}

async function usdaSearch(query: string, dataType: string, pageSize: number, signal: AbortSignal): Promise<FoundFood[]> {
  const q = new URLSearchParams({ api_key: USDA_KEY, query, dataType, pageSize: String(pageSize) })
  const data = await getJson<{ foods?: UsdaFood[] }>(`https://api.nal.usda.gov/fdc/v1/foods/search?${q}`, withTimeout(signal, 20_000))
  return (data.foods ?? []).map(fromUsda).filter((f): f is FoundFood => f !== null)
}

/**
 * USDA: whole foods (best for meat, eggs, rice…) and branded products, as two lists so whole foods aren't buried.
 * If one of the two fails (USDA is sometimes slow), the other's results are still shown.
 */
export async function searchUsda(query: string, signal: AbortSignal): Promise<FoundFood[]> {
  const [generic, branded] = await Promise.allSettled([
    usdaSearch(query, 'Foundation,SR Legacy,Survey (FNDDS)', 10, signal),
    usdaSearch(query, 'Branded', 15, signal),
  ])
  if (generic.status === 'rejected' && branded.status === 'rejected') throw generic.reason
  return [...(generic.status === 'fulfilled' ? generic.value : []), ...(branded.status === 'fulfilled' ? branded.value : [])]
}
