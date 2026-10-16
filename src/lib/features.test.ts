import { describe, expect, it } from 'vitest'
import { resolveFeatures } from './features'

describe('features', () => {
  it('fills defaults: everything on except testing tools', () => {
    const f = resolveFeatures(undefined)
    expect(f.food && f.water && f.sleep && f.planWeek).toBe(true)
    expect(f.testingTools).toBe(false)
  })
  it('keeps stored choices', () => {
    const f = resolveFeatures({ food: false, testingTools: true })
    expect(f.food).toBe(false)
    expect(f.testingTools).toBe(true)
    expect(f.body).toBe(true)
  })
})
