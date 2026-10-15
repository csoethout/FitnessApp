import { fromOff, fromUsda, type FoundFood, type OffProduct, type UsdaFood } from '@/lib/foodSearch'

// Searches go straight from the phone to the free public APIs (see CLAUDE.md → Food search).
// The USDA key is a free read-only key and ends up in the app bundle (accepted). Without one we use
// USDA's shared DEMO_KEY, which works but runs out quickly (about 30 searches an hour).
const USDA_KEY = (import.meta.env.VITE_USDA_API_KEY as string | undefined)?.trim() || 'DEMO_KEY'
export const usingDemoKey = USDA_KEY === 'DEMO_KEY'

const OFF_FIELDS = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments'

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
  const data = await getJson<{ foods?: UsdaFood[] }>(`https://api.nal.usda.gov/fdc/v1/foods/search?${q}`, withTimeout(signal, 10_000))
  return (data.foods ?? []).map(fromUsda).filter((f): f is FoundFood => f !== null)
}

/** USDA: whole foods (best for meat, eggs, rice…) and branded products, as two lists so whole foods aren't buried. */
export async function searchUsda(query: string, signal: AbortSignal): Promise<FoundFood[]> {
  const [generic, branded] = await Promise.all([
    usdaSearch(query, 'Foundation,SR Legacy,Survey (FNDDS)', 10, signal),
    usdaSearch(query, 'Branded', 15, signal),
  ])
  return [...generic, ...branded]
}

/** Open Food Facts text search, US products. Slower and rate-limited (10/min), so we only search on submit. */
export async function searchOff(query: string, signal: AbortSignal): Promise<FoundFood[]> {
  const q = new URLSearchParams({
    search_terms: query, search_simple: '1', action: 'process', json: '1', page_size: '15', fields: OFF_FIELDS,
    tagtype_0: 'countries', tag_contains_0: 'contains', tag_0: 'united-states',
  })
  const data = await getJson<{ products?: OffProduct[] }>(`https://world.openfoodfacts.org/cgi/search.pl?${q}`, withTimeout(signal, 15_000))
  return (data.products ?? []).map(fromOff).filter((f): f is FoundFood => f !== null)
}
