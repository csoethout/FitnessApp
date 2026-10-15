import { sameBarcode } from '@/lib/barcode'
import { fromOff, fromUsda, type FoundFood, type OffProduct, type UsdaFood } from '@/lib/foodSearch'

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

/** Try again quietly when a request fails (USDA / OFF are sometimes slow); gives up after `tries`. */
async function retry<T>(fn: () => Promise<T>, signal: AbortSignal, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (err) {
      if (signal.aborted || i >= tries - 1 || !navigator.onLine) throw err
      await new Promise((r) => setTimeout(r, i === 0 ? 1000 : 3000))
    }
  }
}

/** USDA branded foods by barcode: searches the number and keeps only exact barcode matches. */
export async function barcodeUsda(code: string, signal: AbortSignal): Promise<FoundFood | null> {
  const q = new URLSearchParams({ api_key: USDA_KEY, query: code, dataType: 'Branded', pageSize: '10' })
  const data = await retry(() => getJson<{ foods?: UsdaFood[] }>(`https://api.nal.usda.gov/fdc/v1/foods/search?${q}`, withTimeout(signal, 20_000)), signal)
  const match = (data.foods ?? []).find((f) => sameBarcode(f.gtinUpc, code))
  return match ? fromUsda(match) : null
}

const OFF_FIELDS = 'code,product_name,product_name_en,brands,serving_size,serving_quantity,nutriments'

/** Open Food Facts product by barcode (one quick lookup, unlike their text search). */
export async function barcodeOff(code: string, signal: AbortSignal): Promise<FoundFood | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`
  const data = await retry(async () => {
    const res = await fetch(url, { signal: withTimeout(signal, 20_000) })
    if (res.status === 404) return { status: 0 } // not in their database
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as { status?: number; product?: OffProduct }
  }, signal)
  return data.status === 1 && data.product ? fromOff({ ...data.product, code: data.product.code || code }) : null
}
