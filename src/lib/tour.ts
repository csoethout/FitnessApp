import { useSyncExternalStore } from 'react'

// Tour state lives outside React so the setup wizard (a different screen) can start it before the tab screens mount.
let active = false
let index = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
export const tour = {
  start() {
    active = true
    index = 0
    emit()
  },
  stop() {
    active = false
    emit()
  },
  go(i: number) {
    index = i
    emit()
  },
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const snapshot = () => (active ? index : -1)

/** Current tour step index, or -1 when no tour is running. */
export const useTourIndex = () => useSyncExternalStore(subscribe, snapshot)

