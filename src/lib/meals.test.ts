import { describe, expect, it } from 'vitest'
import { mealPerPortion } from './meals'

const egg = { kcal: 70, protein_g: 6, carbs_g: 0.5, fat_g: 5, cholesterol_mg: 185, sodium_mg: null }
const toast = { kcal: 80, protein_g: 4, carbs_g: 15, fat_g: 1, sodium_mg: 140 }

describe('saved meals', () => {
  it('adds up a meal (makes 1)', () => {
    const p = mealPerPortion([{ food: egg, servings: 4 }, { food: toast, servings: 2 }], 1)
    expect(p).toMatchObject({ kcal: 440, protein_g: 32, carbs_g: 32, fat_g: 22 })
    expect(p.extras).toMatchObject({ cholesterol: 740, sodium: 280, fiber: null })
  })
  it('divides a recipe by its servings', () => {
    const p = mealPerPortion([{ food: egg, servings: 12 }], 6)
    expect(p).toMatchObject({ kcal: 140, protein_g: 12, fat_g: 10 })
  })
  it('handles an empty meal and a bad yield', () => {
    expect(mealPerPortion([], 1)).toMatchObject({ kcal: 0, protein_g: 0 })
    expect(mealPerPortion([{ food: egg, servings: 1 }], 0).kcal).toBe(70)
  })
})
