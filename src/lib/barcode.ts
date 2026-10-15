// Barcode helpers (pure, unit tested). US products use UPC-A (12 digits); the same code as EAN-13 has a leading 0,
// and USDA sometimes stores 14-digit GTINs with extra zeros. Compare without leading zeros.

/** Keep digits only. */
export const cleanBarcode = (raw: string) => raw.replace(/\D/g, '')

/** Same product code, ignoring leading zeros ("012345678905" = "0012345678905"). */
export function sameBarcode(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const strip = (s: string) => cleanBarcode(s).replace(/^0+/, '')
  return strip(a) !== '' && strip(a) === strip(b)
}

/** Checks the last (check) digit of an EAN-8 / UPC-A / EAN-13 / GTIN-14, so a mistyped number is caught. */
export function isValidBarcode(raw: string): boolean {
  const code = cleanBarcode(raw)
  if (![8, 12, 13, 14].includes(code.length) || code !== raw.trim()) return false
  const digits = [...code].map(Number)
  const check = digits.pop()!
  // From the right (excluding the check digit), weights alternate 3, 1, 3, 1…
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/** Short UPC-E (8 digits, small packages) → the full 12-digit UPC-A that databases store. */
export function expandUpcE(raw: string): string {
  const c = cleanBarcode(raw)
  if (c.length !== 8) return c
  const [n, x1, x2, x3, x4, x5, x6, check] = [...c]
  const body =
    x6 <= '2' ? `${x1}${x2}${x6}0000${x3}${x4}${x5}`
    : x6 === '3' ? `${x1}${x2}${x3}00000${x4}${x5}`
    : x6 === '4' ? `${x1}${x2}${x3}${x4}00000${x5}`
    : `${x1}${x2}${x3}${x4}${x5}0000${x6}`
  return `${n}${body}${check}`
}
