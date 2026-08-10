import { describe, expect, it } from 'vitest'
import { AppError } from '@/domain/errors.ts'
import { readAppEnv } from './env.ts'

type ReadAppEnvInput = Parameters<typeof readAppEnv>[0]

describe('readAppEnv', () => {
  it('returns trimmed public configuration values', () => {
    expect(
      readAppEnv({
        VITE_GOOGLE_CLIENT_ID: '  test-client-id  ',
        VITE_BOOTSTRAP_SPREADSHEET_ID: '  spreadsheet-id  ',
        VITE_TEST_SPREADSHEET_ID: '  spreadsheet-id  ',
      } as ReadAppEnvInput),
    ).toEqual({
      googleClientId: 'test-client-id',
      bootstrapSpreadsheetId: 'spreadsheet-id',
      testSpreadsheetId: 'spreadsheet-id',
    })
  })

  it('throws CONFIG_MISSING when required values are absent', () => {
    expect(() =>
      readAppEnv({
        VITE_GOOGLE_CLIENT_ID: '',
        VITE_BOOTSTRAP_SPREADSHEET_ID: 'sheet',
      } as ReadAppEnvInput),
    ).toThrowError(AppError)

    try {
      readAppEnv({
        VITE_GOOGLE_CLIENT_ID: '',
        VITE_BOOTSTRAP_SPREADSHEET_ID: 'sheet',
      } as ReadAppEnvInput)
    } catch (error) {
      expect(error).toMatchObject({
        code: 'CONFIG_MISSING',
      })
    }
  })

  it('keeps reads configurable while leaving writes disabled without a TEST id', () => {
    expect(
      readAppEnv({
        VITE_GOOGLE_CLIENT_ID: 'client-id',
        VITE_BOOTSTRAP_SPREADSHEET_ID: 'spreadsheet-id',
      } as ReadAppEnvInput),
    ).toEqual({
      googleClientId: 'client-id',
      bootstrapSpreadsheetId: 'spreadsheet-id',
      testSpreadsheetId: '',
    })
  })
})
