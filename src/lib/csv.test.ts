import { describe, expect, it } from 'vitest'
import { csvCell, objectsToCsv, toCsv } from './csv'

describe('csv', () => {
  it('quotes only when needed', () => {
    expect(csvCell('Chicken breast')).toBe('Chicken breast')
    expect(csvCell('Eggs, large')).toBe('"Eggs, large"')
    expect(csvCell('6" sub')).toBe('"6"" sub"')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })
  it('writes numbers, booleans, empties and objects', () => {
    expect(csvCell(102.5)).toBe('102.5')
    expect(csvCell(-3)).toBe('-3')
    expect(csvCell(true)).toBe('true')
    expect(csvCell(null)).toBe('')
    expect(csvCell(['barbell', 'cable'])).toBe('"[""barbell"",""cable""]"')
  })
  it('defuses spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1 rep')).toBe("'+1 rep")
    expect(csvCell('-0.5')).toBe('-0.5')
    expect(csvCell('- bad')).toBe("'- bad")
  })
  it('builds files', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n')
    expect(objectsToCsv([{ id: 1 }, { id: 2, extra: 'z' }])).toBe('id,extra\r\n1,\r\n2,z\r\n')
  })
})
