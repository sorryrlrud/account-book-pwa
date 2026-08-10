import { describe, expect, it } from 'vitest'
import { toUserEnteredLiteral } from './format.ts'

describe('sheet text safety', () => {
  it('escapes values that Google Sheets could interpret as formulas', () => {
    expect(toUserEnteredLiteral('=IMPORTXML("https://example.com")')).toBe(
      "'=IMPORTXML(\"https://example.com\")",
    )
    expect(toUserEnteredLiteral('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)")
    expect(toUserEnteredLiteral('일반 텍스트')).toBe('일반 텍스트')
  })
})
