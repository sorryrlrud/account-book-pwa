import { describe, expect, it } from 'vitest'
import { AppError } from '@/domain/errors.ts'
import { parseYearConfig, validateSpreadsheetStructure } from './schema.ts'

describe('schema', () => {
  it('rejects spreadsheets missing required core sheets', () => {
    expect(() =>
      validateSpreadsheetStructure({
        spreadsheetId: 'sheet-2026',
        sheets: [{ properties: { title: '앱설정', sheetId: 1 } }],
      }),
    ).toThrowError(AppError)

    expect(() =>
      validateSpreadsheetStructure({
        spreadsheetId: 'sheet-2026',
        sheets: [{ properties: { title: '앱설정', sheetId: 1 } }],
      }),
    ).toThrowError(/가계부 Sheet 구조/)
  })

  it('parses year config including linked spreadsheet ids', () => {
    const config = parseYearConfig('sheet-2026', '2026 Ledger', {
      values: [
        ['key', 'value'],
        ['year', '2026'],
        ['schemaVersion', '1'],
        ['budgetStartMonth', '8'],
        ['environment', 'TEST'],
        ['previousSpreadsheetId', 'sheet-2025'],
        ['nextSpreadsheetId', 'sheet-2027'],
        ['createdAt', '2026-01-01T00:00:00.000Z'],
        ['updatedAt', '2026-08-01T00:00:00.000Z'],
      ],
    })

    expect(config).toMatchObject({
      spreadsheetId: 'sheet-2026',
      year: 2026,
      schemaVersion: 1,
      budgetStartMonth: 8,
      environment: 'TEST',
      previousSpreadsheetId: 'sheet-2025',
      nextSpreadsheetId: 'sheet-2027',
    })
  })

  it('rejects invalid year config values', () => {
    expect(() =>
      parseYearConfig('sheet-2026', '2026 Ledger', {
        values: [
          ['key', 'value'],
          ['year', 'two-thousand-twenty-six'],
          ['schemaVersion', '1'],
        ],
      }),
    ).toThrowError(AppError)
  })

  it('rejects unsupported schema versions', () => {
    expect(() =>
      parseYearConfig('sheet-2026', '2026 Ledger', {
        values: [
          ['key', 'value'],
          ['year', '2026'],
          ['schemaVersion', '2'],
        ],
      }),
    ).toThrowError(/다른 데이터 형식/)
  })
})
