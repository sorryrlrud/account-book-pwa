import { describe, expect, it } from 'vitest'
import { parseAmountInput, toAmountInput } from './format.ts'

describe('transaction amount input formatting', () => {
  it('adds thousands separators while keeping only digits', () => {
    expect(toAmountInput('15000')).toBe('15,000')
    expect(toAmountInput('1,234,567원')).toBe('1,234,567')
    expect(toAmountInput('')).toBe('')
  })

  it('parses a formatted amount for persistence', () => {
    expect(parseAmountInput('1,234,567')).toBe(1_234_567)
  })
})
