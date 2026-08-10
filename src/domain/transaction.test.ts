import { describe, expect, it } from 'vitest'
import {
  inferLegacyTransactionType,
  normalizePositiveAmount,
  toSignedAmount,
} from './transaction.ts'
import {
  collapseTransferPairs,
  parseTransactions,
} from '@/services/sheets/transactionAdapter.ts'

describe('transaction domain helpers', () => {
  it('ignores a human-readable month-sheet header row', () => {
    const transactions = parseTransactions(2026, 8, [
      ['날짜', '금액', '내용', '통장', '분류'],
      ['2026. 8. 10.', '-24000', '트릿', '네페', '고냥'],
    ])

    expect(transactions).toHaveLength(1)
    expect(transactions[0]).toMatchObject({
      date: '2026-08-10',
      amount: -24000,
      description: '트릿',
    })
  })

  it('collapses two transfer rows into one logical transaction', () => {
    const rows = new Array<string>(26).fill('')
    const incoming = new Array<string>(26).fill('')
    rows.splice(0, 5, '2026-08-10', '-1000000', '생활비 이동', '토스', '')
    rows[23] = 'transfer'
    rows[25] = 'trf_shared'
    incoming.splice(0, 5, '2026-08-10', '1000000', '생활비 이동', '파킹', '')
    incoming[23] = 'transfer'
    incoming[25] = 'trf_shared'

    const logical = collapseTransferPairs(
      parseTransactions(2026, 8, [rows, incoming]),
    )

    expect(logical).toHaveLength(1)
    expect(logical[0]).toMatchObject({
      amount: -1000000,
      account: '토스',
      destinationAccount: '파킹',
      transferId: 'trf_shared',
    })
  })

  it('stores expenses as negative numbers', () => {
    expect(toSignedAmount('expense', 24_000)).toBe(-24_000)
    expect(toSignedAmount('expense', -24_000)).toBe(-24_000)
  })

  it('stores incomes as positive numbers', () => {
    expect(toSignedAmount('income', 5_900_000)).toBe(5_900_000)
    expect(toSignedAmount('income', -5_900_000)).toBe(5_900_000)
  })

  it('normalizes UI amounts to a positive magnitude', () => {
    expect(normalizePositiveAmount(-1234)).toBe(1234)
    expect(normalizePositiveAmount(1234)).toBe(1234)
  })

  it('infers legacy expenses when category exists and amount is negative', () => {
    expect(inferLegacyTransactionType(-35_000, '식비')).toBe('expense')
  })

  it('infers legacy incomes when category exists and amount is positive', () => {
    expect(inferLegacyTransactionType(5_900_000, '급여')).toBe('income')
  })

  it('treats category-less or zero-amount rows as unknown', () => {
    expect(inferLegacyTransactionType(-10_000)).toBe('unknown')
    expect(inferLegacyTransactionType(0, '미분류')).toBe('unknown')
  })
})
