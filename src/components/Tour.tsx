import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useFeatures } from '@/data/profile'
import { tour, useTourIndex } from '@/lib/tour'
import { TOUR_STEPS } from '@/lib/tourSteps'

type Rect = { top: number; left: number; width: number; height: number }
const PAD = 6

/**
 * Guided tour: opens each screen, dims everything except one highlighted element and explains it in a bubble.
 * Taps outside the bubble are blocked so the tour can't be lost halfway.
 */
export function TourOverlay() {
  const current = useTourIndex()
  const features = useFeatures()
  const steps = useMemo(() => (features ? TOUR_STEPS.filter((s) => !s.feature || features[s.feature]) : []), [features])
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const step = current >= 0 ? steps[current] : undefined
  // What we found for which step (results for an older step are ignored).
  const key = `${current}:${pathname}`
  const [found, setFound] = useState<{ key: string; rect: Rect | null } | null>(null)
  const rect = found?.key === key ? found.rect : null
  const ready = !step?.target || found?.key === key

  // Open the step's screen.
  useEffect(() => {
    if (step && pathname !== step.route) navigate(step.route)
  }, [step, pathname, navigate])

  // Find the element (screens load their data a moment after opening), scroll it into view and follow it.
  useLayoutEffect(() => {
    if (!step?.target || pathname !== step.route) return
    let el: Element | null = null
    let tries = 0
    let timer = 0
    const measure = () => {
      if (!el) return
      const r = el.getBoundingClientRect()
      // Very tall elements (a long list): highlight the part that's on screen.
      const top = Math.max(r.top, 8)
      const bottom = Math.min(r.bottom, window.innerHeight - 8)
      setFound({ key, rect: { top: top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: Math.max(0, bottom - top) + PAD * 2 } })
    }
    const find = () => {
      el = document.querySelector(`[data-tour="${step.target}"]`)
      if (el) {
        el.scrollIntoView({ block: 'center' })
        requestAnimationFrame(measure)
      } else if (tries++ < 30) {
        timer = window.setTimeout(find, 100)
      } else {
        setFound({ key, rect: null }) // not on screen (e.g. no data yet): explain without a highlight
      }
    }
    timer = window.setTimeout(find, 0)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step, pathname, key])

  if (!step) return null
  const last = current === steps.length - 1
  const next = () => (last ? tour.stop() : tour.go(current + 1))

  // Bubble below the highlight if it fits, else above, else pinned to the bottom of the screen.
  const BUBBLE = 210
  let bubbleStyle: CSSProperties = { left: 16, right: 16, top: '50%', transform: 'translateY(-50%)' }
  if (rect) {
    const below = window.innerHeight - (rect.top + rect.height)
    if (below > BUBBLE + 16) bubbleStyle = { left: 16, right: 16, top: rect.top + rect.height + 12 }
    else if (rect.top > BUBBLE + 16) bubbleStyle = { left: 16, right: 16, bottom: window.innerHeight - rect.top + 12 }
    else bubbleStyle = { left: 16, right: 16, bottom: 'max(16px, env(safe-area-inset-bottom))' }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Tour: ${step.title}`}>
      {/* Dims the screen and swallows taps; the highlight is a hole made by a huge shadow. */}
      <div className={`absolute inset-0 ${rect ? '' : 'bg-black/70'}`} />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-accent transition-all duration-300"
          style={{ ...rect, boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)' }}
        />
      )}
      {ready && (
        <div className="absolute rounded-2xl border border-accent/60 bg-surface p-4 shadow-2xl" style={bubbleStyle}>
          <p className="text-xs text-muted">
            {current + 1} of {steps.length}
          </p>
          <h2 className="text-lg font-semibold">{step.title}</h2>
          <p className="mt-1 text-sm">{step.text}</p>
          <div className="mt-3 flex items-center gap-2">
            {!last && (
              <button type="button" onClick={() => tour.stop()} className="min-h-12 px-2 text-sm text-muted">
                Skip tour
              </button>
            )}
            <span className="flex-1" />
            {current > 0 && (
              <button type="button" onClick={() => tour.go(current - 1)} className="min-h-12 rounded-xl border border-border px-4">
                Back
              </button>
            )}
            <button type="button" onClick={next} className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
