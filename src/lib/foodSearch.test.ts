import { describe, expect, it } from 'vitest'
import { amountLabel, fromOff, fromUsda, mergeResults, servingLabel, tidyName } from './foodSearch'

const usdaGeneric = {
  fdcId: 171477,
  description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted',
  dataType: 'SR Legacy',
  foodNutrients: [
    { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 31.0 },
    { nutrientId: 1004, nutrientNumber: '204', unitName: 'G', value: 3.57 },
    { nutrientId: 1005, nutrientNumber: '205', unitName: 'G', value: 0 },
    { nutrientId: 1062, nutrientNumber: '268', unitName: 'kJ', value: 690 },
    { nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 165 },
    { nutrientId: 1093, nutrientNumber: '307', unitName: 'MG', value: 74 },
    { nutrientId: 1253, nutrientNumber: '601', unitName: 'MG', value: 85 },
  ],
}
const usdaBranded = {
  fdcId: 2000001,
  description: 'NONFAT GREEK YOGURT',
  dataType: 'Branded',
  brandOwner: 'Fage USA Dairy Industry, Inc.',
  brandName: 'FAGE',
  gtinUpc: '689544080503',
  servingSize: 170,
  servingSizeUnit: 'g',
  householdServingFullText: '1 container',
  foodNutrients: [
    { nutrientId: 1008, nutrientNumber: '208', unitName: 'KCAL', value: 53 },
    { nutrientId: 1003, nutrientNumber: '203', unitName: 'G', value: 10.6 },
    { nutrientId: 1005, nutrientNumber: '205', unitName: 'G', value: 3.53 },
    { nutrientId: 1004, nutrientNumber: '204', unitName: 'G', value: 0 },
    { nutrientId: 2000, nutrientNumber: '269', unitName: 'G', value: 3.53 },
  ],
}

describe('USDA', () => {
  it('keeps whole foods per 100 g', () => {
    const f = fromUsda(usdaGeneric)!
    expect(f).toMatchObject({ source: 'usda', source_id: '171477', generic: true, brand: null, serving_amount: 100, serving_unit: 'g', serving_grams: 100 })
    expect(f).toMatchObject({ kcal: 165, protein_g: 31, fat_g: 3.6, carbs_g: 0, sodium_mg: 74, cholesterol_mg: 85, fiber_g: null })
  })
  it('converts branded foods to the label serving', () => {
    const f = fromUsda(usdaBranded)!
    expect(f).toMatchObject({ generic: false, brand: 'Fage', name: 'Nonfat Greek Yogurt', barcode: '689544080503', serving_amount: 1, serving_unit: '1 container (170 g)', serving_grams: 170 })
    expect(f).toMatchObject({ kcal: 90, protein_g: 18, carbs_g: 6, sugar_g: 6 })
  })
  it('falls back to Atwater energy, ignores kJ, and skips foods with no calories', () => {
    const atwater = fromUsda({ fdcId: 1, description: 'Egg, whole, raw', dataType: 'Foundation', foodNutrients: [{ nutrientId: 1062, unitName: 'kJ', value: 600 }, { nutrientId: 2047, unitName: 'KCAL', value: 143 }] })
    expect(atwater?.kcal).toBe(143)
    expect(fromUsda({ fdcId: 2, description: 'x', foodNutrients: [{ nutrientId: 1062, unitName: 'kJ', value: 600 }] })).toBeNull()
  })
})

describe('Open Food Facts', () => {
  it('uses the serving quantity and converts sodium/cholesterol from g to mg', () => {
    const f = fromOff({
      code: '0041498123456', product_name: 'Beef Jerky', brands: 'Jack Link’s, Link Snacks', serving_size: '1 oz (28 g)', serving_quantity: '28',
      nutriments: { 'energy-kcal_100g': 286, proteins_100g: 46.4, carbohydrates_100g: 21.4, fat_100g: 3.6, sodium_100g: 2.07, cholesterol_100g: 0.071 },
    })!
    expect(f).toMatchObject({ source: 'off', barcode: '0041498123456', brand: 'Jack Link’s', serving_unit: '1 oz (28 g)', serving_grams: 28 })
    expect(f).toMatchObject({ kcal: 80, protein_g: 13, carbs_g: 6, fat_g: 1, sodium_mg: 579.6, cholesterol_mg: 19.9 })
  })
  it('falls back to kJ and to per 100 g', () => {
    const f = fromOff({ code: '1', product_name: 'Rice', nutriments: { energy_100g: 1500, proteins_100g: 7 } })!
    expect(f).toMatchObject({ kcal: 359, serving_amount: 100, serving_unit: 'g', fiber_g: null })
  })
  it('reads per-language names and brand lists (newer search service)', () => {
    const f = fromOff({ code: '9', product_name: { main: 'Yaourt', en: 'Yogurt' }, brands: ['Chobani', 'Other'], nutriments: { 'energy-kcal_100g': 60 } })!
    expect(f).toMatchObject({ name: 'Yogurt', brand: 'Chobani' })
  })
  it('skips products without a name or calories', () => {
    expect(fromOff({ code: '1', product_name: '', nutriments: { 'energy-kcal_100g': 100 } })).toBeNull()
    expect(fromOff({ code: '1', product_name: 'X', nutriments: {} })).toBeNull()
  })
})

describe('helpers', () => {
  it('orders whole foods first and drops duplicate barcodes', () => {
    const generic = fromUsda(usdaGeneric)!
    const branded = fromUsda(usdaBranded)!
    const offSame = fromOff({ code: '0689544080503', product_name: 'Greek yogurt', nutriments: { 'energy-kcal_100g': 53 } })!
    const offOther = fromOff({ code: '5', product_name: 'Other', nutriments: { 'energy-kcal_100g': 53 } })!
    expect(mergeResults([branded, generic], [offSame, offOther]).map((f) => f.source_id)).toEqual(['171477', '2000001', '5'])
  })
  it('tidies all-caps names only', () => {
    expect(tidyName('CHICKEN BREAST (BONELESS)')).toBe('Chicken Breast (Boneless)')
    expect(tidyName('Chicken, breast')).toBe('Chicken, breast')
  })
  it('labels servings', () => {
    expect(servingLabel({ serving_amount: 100, serving_unit: 'g' })).toBe('100 g')
    expect(servingLabel({ serving_amount: 1, serving_unit: '1 oz (28 g)' })).toBe('1 oz (28 g)')
    expect(servingLabel({ serving_amount: 1, serving_unit: 'cup' })).toBe('1 cup')
    expect(amountLabel(2.25, { serving_amount: 100, serving_unit: 'g', serving_grams: 100 })).toBe('225 g')
    expect(amountLabel(1, { serving_amount: 1, serving_unit: 'cup', serving_grams: null })).toBe('1 serving')
    expect(amountLabel(1.5, { serving_amount: 1, serving_unit: '1 container (170 g)', serving_grams: 170 })).toBe('1.5 servings')
    expect(amountLabel(180 / 170, { serving_amount: 1, serving_unit: '1 container (170 g)', serving_grams: 170 })).toBe('180 g')
    expect(amountLabel(1.5, null)).toBe('1.5 servings')
  })
})
