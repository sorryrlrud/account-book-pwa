import { describe, expect, it } from 'vitest'
import { parseSheetNumber, toUserEnteredLiteral } from './format.ts'

describe('sheet number parsing', () => {
  it('parses Google Sheet currency display formats', () => {
    expect(parseSheetNumber('₩1,234,567')).toBe(1_234_567)
    expect(parseSheetNumber('-₩24,000')).toBe(-24_000)
    expect(parseSheetNumber('₩(35,000)')).toBe(-35_000)
    expect(parseSheetNumber('1,500,000원')).toBe(1_500_000)
    expect(parseSheetNumber('KRW 5,900,000')).toBe(5_900_000)
  })

  it('returns zero for empty or invalid numeric cells', () => {
    expect(parseSheetNumber('')).toBe(0)
    expect(parseSheetNumber('금액 미정')).toBe(0)
    expect(parseSheetNumber('₩(1,000')).toBe(0)
  })
})

describe('sheet text safety', () => {
  it('escapes values that Google Sheets could interpret as formulas', () => {
    expect(toUserEnteredLiteral('=IMPORTXML("https://example.com")')).toBe(
      "'=IMPORTXML(\"https://example.com\")",
    )
    expect(toUserEnteredLiteral('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)")
    expect(toUserEnteredLiteral('일반 텍스트')).toBe('일반 텍스트')
  })
})
