import { describe, expect, it } from 'vitest'
import {
  assertMonth,
  getYearMonthFromDate,
  parseLedgerDate,
  toIsoDateInKst,
  toKstDateParts,
} from './date.ts'

describe('date utilities', () => {
  it('converts UTC time to Asia/Seoul calendar parts', () => {
    const date = new Date('2026-08-09T16:30:00.000Z')

    expect(toKstDateParts(date)).toEqual({
      year: 2026,
      month: 8,
      day: 10,
    })
    expect(toIsoDateInKst(date)).toBe('2026-08-10')
  })

  it('parses ISO and legacy short dates into YYYY-MM-DD', () => {
    expect(parseLedgerDate('2026-08-10')).toBe('2026-08-10')
    expect(parseLedgerDate('26/8/10')).toBe('2026-08-10')
    expect(parseLedgerDate('2026.8.10')).toBe('2026-08-10')
    expect(parseLedgerDate('2026-8-10')).toBe('2026-08-10')
    expect(parseLedgerDate('2026. 8. 10.')).toBe('2026-08-10')
  })

  it('maps a ledger date to the correct year and month sheet', () => {
    expect(getYearMonthFromDate('2026-08-10')).toEqual({
      year: 2026,
      month: 8,
    })
    expect(getYearMonthFromDate('27/1/3')).toEqual({
      year: 2027,
      month: 1,
    })
  })

  it('rejects malformed dates', () => {
    expect(() => parseLedgerDate('20260810')).toThrow('Invalid ledger date')
    expect(() => parseLedgerDate('abc')).toThrow('Invalid ledger date')
    expect(() => parseLedgerDate('2026-02-30')).toThrow('Invalid ledger date')
  })

  it('accepts only snapshot and real month ranges', () => {
    expect(() => assertMonth(0)).not.toThrow()
    expect(() => assertMonth(12)).not.toThrow()
    expect(() => assertMonth(-1)).toThrow('Invalid month')
    expect(() => assertMonth(13)).toThrow('Invalid month')
    expect(() => assertMonth(1.5)).toThrow('Invalid month')
  })
})
