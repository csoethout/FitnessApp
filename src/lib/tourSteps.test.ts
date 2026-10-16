import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TOUR_STEPS } from './tourSteps'

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? sources(join(dir, f.name)) : f.name.endsWith('.tsx') ? [readFileSync(join(dir, f.name), 'utf8')] : []))

describe('tour steps', () => {
  it('every highlighted element is tagged in the screens', () => {
    const code = sources('src').join('\n')
    for (const s of TOUR_STEPS) if (s.target) expect(code, s.target).toMatch(new RegExp(`data-tour=(?:"|\\{[^}]*')${s.target}['"]`))
  })
  it('only visits tab screens', () => {
    for (const s of TOUR_STEPS) expect(['/', '/train', '/food', '/progress', '/more']).toContain(s.route)
  })
})
