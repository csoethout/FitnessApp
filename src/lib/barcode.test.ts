import { describe, expect, it } from 'vitest'
import { expandUpcE, isValidBarcode, sameBarcode } from './barcode'

describe('barcodes', () => {
  it('treats UPC-A, EAN-13 and GTIN-14 forms of one code as the same', () => {
    expect(sameBarcode('689544080503', '0689544080503')).toBe(true)
    expect(sameBarcode('00689544080503', '689544080503')).toBe(true)
    expect(sameBarcode('689544080503', '689544080510')).toBe(false)
    expect(sameBarcode('0000', '0')).toBe(false)
    expect(sameBarcode(null, '1')).toBe(false)
  })
  it('checks the check digit', () => {
    expect(isValidBarcode('036000291452')).toBe(true) // UPC-A
    expect(isValidBarcode('4006381333931')).toBe(true) // EAN-13
    expect(isValidBarcode('96385074')).toBe(true) // EAN-8
    expect(isValidBarcode('036000291453')).toBe(false)
    expect(isValidBarcode('12345')).toBe(false)
    expect(isValidBarcode('03600029145a')).toBe(false)
  })
  it('expands short UPC-E codes', () => {
    expect(expandUpcE('04252614')).toBe('042100005264')
    expect(isValidBarcode(expandUpcE('04252614'))).toBe(true)
    expect(expandUpcE('01234565')).toBe('012345000065')
    expect(isValidBarcode(expandUpcE('01234565'))).toBe(true)
  })
})
