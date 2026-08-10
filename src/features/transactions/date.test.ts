import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  currentMonthValue,
  shiftDate,
  shiftMonth,
} from './date.ts'

describe('transaction date helpers', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves one day across month boundaries', () => {
    expect(shiftDate('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('uses Asia/Seoul when resolving the current month near a UTC month boundary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-31T15:30:00.000Z'))

    expect(currentMonthValue()).toBe('2026-09')
    expect(shiftMonth('invalid', 0)).toBe('2026-09')
  })

  it('falls back to today in Asia/Seoul when shifting an invalid date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T15:30:00.000Z'))

    expect(shiftDate('not-a-date', 1)).toBe('2026-08-11')
  })
})
