// Turn USDA FoodData Central and Open Food Facts results into one shape (pure, unit tested).
// Both sources give values per 100 g; we convert to per serving when the serving's weight is known.

export type FoundFood = {
  source: 'usda' | 'off'
  source_id: string
  barcode: string | null
  name: string
  brand: string | null
  generic: boolean // whole food (USDA Foundation / SR Legacy / Survey) rather than a branded product
  serving_amount: number
  serving_unit: string
  serving_grams: number | null
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  sugar_g: number | null
  sat_fat_g: number | null
  trans_fat_g: number | null
  cholesterol_mg: number | null
  sodium_mg: number | null
}

type Per100 = Omit<FoundFood, 'source' | 'source_id' | 'barcode' | 'name' | 'brand' | 'generic' | 'serving_amount' | 'serving_unit' | 'serving_grams'>

const r1 = (n: number) => Math.round(n * 10) / 10
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}

/** Scale per-100 g values to a serving of `grams`. */
function scale(p: Per100, grams: number): Per100 {
  const f = grams / 100
  const s = (v: number | null) => (v === null ? null : r1(v * f))
  return {
    kcal: Math.round(p.kcal * f), protein_g: r1(p.protein_g * f), carbs_g: r1(p.carbs_g * f), fat_g: r1(p.fat_g * f),
    fiber_g: s(p.fiber_g), sugar_g: s(p.sugar_g), sat_fat_g: s(p.sat_fat_g), trans_fat_g: s(p.trans_fat_g),
    cholesterol_mg: s(p.cholesterol_mg), sodium_mg: s(p.sodium_mg),
  }
}

/** "CHICKEN BREAST FILLETS" → "Chicken Breast Fillets" (branded USDA names are often all caps). */
export function tidyName(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t !== t.toUpperCase() || !/[A-Z]/.test(t)) return t
  return t.toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
}

// ---------- USDA ----------

type UsdaNutrient = { nutrientId?: number; nutrientNumber?: string; unitName?: string; value?: number }
export type UsdaFood = {
  fdcId: number
  description: string
  dataType?: string
  brandOwner?: string
  brandName?: string
  gtinUpc?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: UsdaNutrient[]
  publishedDate?: string // search results: "2021-03-11"; details: "3/11/2021"
  modifiedDate?: string
  /** Only in the details endpoint (/food/{id}) for branded foods: the panel as printed, per serving. */
  labelNutrients?: Partial<Record<'calories' | 'protein' | 'carbohydrates' | 'fat' | 'fiber' | 'sugars' | 'saturatedFat' | 'transFat' | 'cholesterol' | 'sodium', { value?: number }>>
}

// nutrientId, with the older nutrientNumber as a fallback.
const USDA = {
  kcal: [[1008, '208'], [2047, '957'], [2048, '958']],
  protein: [[1003, '203']],
  carbs: [[1005, '205']],
  fat: [[1004, '204']],
  fiber: [[1079, '291']],
  sugar: [[2000, '269'], [1063, '269.3']],
  sat: [[1258, '606']],
  trans: [[1257, '605']],
  chol: [[1253, '601']],
  sodium: [[1093, '307']],
} as const

function usdaValue(list: UsdaNutrient[], keys: readonly (readonly [number, string])[], kcal = false): number | null {
  for (const [id, number] of keys) {
    const n = list.find((x) => (x.nutrientId === id || x.nutrientNumber === number) && (!kcal || x.unitName?.toUpperCase() === 'KCAL'))
    const v = num(n?.value)
    if (v !== null) return v
  }
  return null
}

/** One USDA search result → FoundFood, or null when it has no calories. Search results are per 100 g. */
export function fromUsda(f: UsdaFood): FoundFood | null {
  const list = f.foodNutrients ?? []
  const kcal = usdaValue(list, USDA.kcal, true)
  if (kcal === null) return null
  const per100: Per100 = {
    kcal, protein_g: usdaValue(list, USDA.protein) ?? 0, carbs_g: usdaValue(list, USDA.carbs) ?? 0, fat_g: usdaValue(list, USDA.fat) ?? 0,
    fiber_g: usdaValue(list, USDA.fiber), sugar_g: usdaValue(list, USDA.sugar), sat_fat_g: usdaValue(list, USDA.sat),
    trans_fat_g: usdaValue(list, USDA.trans), cholesterol_mg: usdaValue(list, USDA.chol), sodium_mg: usdaValue(list, USDA.sodium),
  }
  const branded = f.dataType === 'Branded'
  const unit = (f.servingSizeUnit ?? '').toLowerCase()
  const grams = branded && (unit === 'g' || unit === 'grm') ? num(f.servingSize) : null
  const base = {
    source: 'usda' as const, source_id: String(f.fdcId), barcode: f.gtinUpc?.trim() || null, name: tidyName(f.description),
    brand: branded ? tidyName(f.brandName || f.brandOwner || '') || null : null, generic: !branded,
  }
  if (grams) {
    const label = f.householdServingFullText?.trim()
    return { ...base, ...scale(per100, grams), serving_amount: 1, serving_unit: label ? `${label} (${r1(grams)} g)`.slice(0, 60) : `${r1(grams)} g`, serving_grams: grams }
  }
  return { ...base, ...scale(per100, 100), serving_amount: 100, serving_unit: 'g', serving_grams: 100 }
}

/** Newest record first: USDA keeps old versions of a product (older labels, different serving sizes). */
export function newestFirst(foods: UsdaFood[]): UsdaFood[] {
  const t = (f: UsdaFood) => Date.parse(f.modifiedDate || f.publishedDate || '') || 0
  return [...foods].sort((a, b) => t(b) - t(a))
}

/**
 * A branded USDA food from the details endpoint, using its label panel (per serving, exactly as printed) rather than
 * per-100 g values scaled back, which can drift or use a different serving. Null when there's no usable label.
 */
export function fromUsdaLabel(f: UsdaFood): FoundFood | null {
  const l = f.labelNutrients
  const v = (k: keyof NonNullable<UsdaFood['labelNutrients']>) => num(l?.[k]?.value)
  const kcal = v('calories')
  const size = num(f.servingSize)
  if (!l || kcal === null || !size) return null
  const unit = (f.servingSizeUnit ?? '').toLowerCase()
  const isGrams = unit === 'g' || unit === 'grm'
  const sizeText = `${r1(size)} ${isGrams ? 'g' : unit === 'mlt' ? 'ml' : unit}`
  const label = f.householdServingFullText?.trim()
  return {
    source: 'usda', source_id: String(f.fdcId), barcode: f.gtinUpc?.trim() || null, name: tidyName(f.description),
    brand: tidyName(f.brandName || f.brandOwner || '') || null, generic: false,
    serving_amount: 1, serving_unit: (label ? `${label} (${sizeText})` : sizeText).slice(0, 60), serving_grams: isGrams ? size : null,
    kcal: Math.round(kcal), protein_g: r1(v('protein') ?? 0), carbs_g: r1(v('carbohydrates') ?? 0), fat_g: r1(v('fat') ?? 0),
    fiber_g: v('fiber'), sugar_g: v('sugars'), sat_fat_g: v('saturatedFat'), trans_fat_g: v('transFat'),
    cholesterol_mg: v('cholesterol'), sodium_mg: v('sodium'),
  }
}

// ---------- Open Food Facts ----------

// The newer search service may return names per language ({ en, main, … }) and brands as a list.
type Text = string | Record<string, string | undefined>
export type OffProduct = {
  code?: string
  product_name?: Text
  product_name_en?: string
  brands?: string | string[]
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

function pickText(t: Text | undefined): string {
  if (!t) return ''
  if (typeof t === 'string') return t
  return t.en || t.main || Object.values(t).find((v) => !!v) || ''
}

/** One Open Food Facts product → FoundFood, or null when it has no name or calories. */
export function fromOff(p: OffProduct): FoundFood | null {
  const n = p.nutriments ?? {}
  const name = (p.product_name_en || pickText(p.product_name)).trim()
  const kj = num(n['energy_100g'])
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== null ? kj / 4.184 : null)
  if (!name || !p.code || kcal === null) return null
  const g = (k: string) => num(n[`${k}_100g`])
  const mg = (k: string) => {
    const v = g(k) // OFF stores sodium and cholesterol in grams
    return v === null ? null : v * 1000
  }
  const per100: Per100 = {
    kcal, protein_g: g('proteins') ?? 0, carbs_g: g('carbohydrates') ?? 0, fat_g: g('fat') ?? 0,
    fiber_g: g('fiber'), sugar_g: g('sugars'), sat_fat_g: g('saturated-fat'), trans_fat_g: g('trans-fat'),
    cholesterol_mg: mg('cholesterol'), sodium_mg: mg('sodium'),
  }
  const base = {
    source: 'off' as const, source_id: p.code, barcode: p.code, name: tidyName(name),
    brand: (Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(',')[0])?.trim() || null, generic: false,
  }
  const grams = num(p.serving_quantity)
  if (grams && grams > 0) {
    const label = p.serving_size?.trim()
    const serving = { serving_amount: 1, serving_unit: (label || `${r1(grams)} g`).slice(0, 60), serving_grams: grams }
    // Prefer the per-serving numbers when OFF has them (often typed straight from the label).
    const s = (k: string) => num(n[`${k}_serving`])
    const kcalServing = s('energy-kcal')
    if (kcalServing !== null && s('proteins') !== null) {
      const sm = (k: string) => {
        const v = s(k)
        return v === null ? null : r1(v * 1000)
      }
      return {
        ...base, ...serving, kcal: Math.round(kcalServing), protein_g: r1(s('proteins') ?? 0), carbs_g: r1(s('carbohydrates') ?? 0), fat_g: r1(s('fat') ?? 0),
        fiber_g: s('fiber'), sugar_g: s('sugars'), sat_fat_g: s('saturated-fat'), trans_fat_g: s('trans-fat'), cholesterol_mg: sm('cholesterol'), sodium_mg: sm('sodium'),
      }
    }
    return { ...base, ...scale(per100, grams), ...serving }
  }
  return { ...base, ...scale(per100, 100), serving_amount: 100, serving_unit: 'g', serving_grams: 100 }
}

/** Whole foods first (best for meat, eggs, rice…), then branded USDA, then Open Food Facts. */
export function mergeResults(usda: FoundFood[], off: FoundFood[]): FoundFood[] {
  const seen = new Set<string>()
  const out: FoundFood[] = []
  for (const f of [...usda.filter((x) => x.generic), ...usda.filter((x) => !x.generic), ...off]) {
    const key = f.barcode ? `bc:${f.barcode.replace(/^0+/, '')}` : `${f.source}:${f.source_id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f)
  }
  return out
}

/** How to describe a serving in a list: "1 cup (170 g)" or "100 g". */
export function servingLabel(f: { serving_amount: number; serving_unit: string }): string {
  return f.serving_amount === 1 && /\d/.test(f.serving_unit) ? f.serving_unit : `${f.serving_amount} ${f.serving_unit}`
}

/** How much was eaten, for the day list: "225 g" for foods measured per gram, else "1.5 servings". */
export function amountLabel(servings: number, food: { serving_amount: number; serving_unit: string; serving_grams: number | null } | null | undefined): string {
  if (food?.serving_unit === 'g') return `${Math.round(servings * food.serving_amount)} g`
  // Entered in grams (not a whole quarter serving) → show grams.
  if (food?.serving_grams && Math.abs(servings * 4 - Math.round(servings * 4)) > 0.001) return `${Math.round(servings * food.serving_grams)} g`
  const n = Math.round(servings * 100) / 100
  return `${n} serving${n === 1 ? '' : 's'}`
}

/** Does `text` contain every word of `query`? Case-insensitive; "chi bre" matches "Chicken breast". */
export function matchesQuery(text: string, query: string): boolean {
  const t = text.toLowerCase()
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.length > 0 && words.every((w) => t.includes(w))
}
