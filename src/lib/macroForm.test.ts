import { describe, expect, it } from 'vitest'
import { EMPTY_MACROS, effectiveKcal, macrosValid } from './macroForm'

describe('macro form', () => {
  it('calculates calories from macros until typed', () => {
    expect(effectiveKcal(EMPTY_MACROS)).toBeNull()
    expect(effectiveKcal({ ...EMPTY_MACROS, protein: 25, fat: 2 })).toBe(118)
    expect(effectiveKcal({ ...EMPTY_MACROS, protein: 25, kcal: 120, kcalTyped: true })).toBe(120)
    // cleared mid-edit: falls back to the calculated value
    expect(effectiveKcal({ ...EMPTY_MACROS, protein: 25, kcal: null, kcalTyped: true })).toBe(100)
  })
  it('blocks macros that need more calories than entered', () => {
    expect(macrosValid({ ...EMPTY_MACROS, protein: 100, kcal: 100, kcalTyped: true })).toBe(false)
    expect(macrosValid({ ...EMPTY_MACROS, protein: 100 })).toBe(true)
    expect(macrosValid({ ...EMPTY_MACROS, kcal: 300, kcalTyped: true })).toBe(true)
    expect(macrosValid(EMPTY_MACROS)).toBe(false)
  })
})
