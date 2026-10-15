import { afterEach, describe, expect, it, vi } from 'vitest'
import { restTimer } from './restTimer'

afterEach(() => {
  restTimer.skip()
  vi.useRealTimers()
})

describe('restTimer', () => {
  it('stores an end time and adjusts it', () => {
    vi.useFakeTimers({ now: 1_000_000 })
    restTimer.start(120, 'w1')
    expect(restTimer.get()).toEqual({ endsAt: 1_120_000, total: 120, workoutId: 'w1' })
    restTimer.adjust(15)
    expect(restTimer.get()?.endsAt).toBe(1_135_000)
    restTimer.adjust(-300) // never goes below "now"
    expect(restTimer.get()?.endsAt).toBe(1_000_000)
    restTimer.restart(180)
    expect(restTimer.get()).toMatchObject({ endsAt: 1_180_000, total: 180 })
    restTimer.skip()
    expect(restTimer.get()).toBeNull()
  })
})
