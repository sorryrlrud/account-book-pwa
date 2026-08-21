import { AppError } from '@/domain/errors.ts'
import type { YearConfig } from '@/domain/year.ts'
import type { SheetsSpreadsheet, SheetsValueRange } from '@/services/sheets/sheetsClient.ts'
import { trimCell } from '@/utils/format.ts'

export const REQUIRED_CORE_SHEETS = [
  '앱설정',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '통장',
  '카테고리',
  '예산그룹',
  '예산월별',
] as const

export function validateSpreadsheetStructure(spreadsheet: SheetsSpreadsheet): void {
  const sheetTitles = new Set(
    spreadsheet.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
  )

  const missingSheets = REQUIRED_CORE_SHEETS.filter((sheetTitle) => !sheetTitles.has(sheetTitle))
  if (missingSheets.length > 0) {
    throw new AppError(
      'SCHEMA_MISMATCH',
      '가계부 Sheet 구조를 확인해주세요.',
      { details: { missingSheets } },
    )
  }
}

export function parseYearConfig(
  spreadsheetId: string,
  _spreadsheetTitle: string | undefined,
  appSettingsRange: SheetsValueRange,
): YearConfig {
  const rows = appSettingsRange.values ?? []
  const keyValueRows = rows.slice(1)
  const kv = new Map<string, string>()
  for (const row of keyValueRows) {
    const key = trimCell(row[0])
    if (!key) {
      continue
    }
    kv.set(key, trimCell(row[1]))
  }

  const year = Number(kv.get('year'))
  const schemaVersion = Number(kv.get('schemaVersion'))
  const budgetStartMonth = Number(kv.get('budgetStartMonth') || 1)
  if (!Number.isInteger(year) || !Number.isInteger(schemaVersion)) {
    throw new AppError(
      'INVALID_CONFIG',
      '앱설정 Sheet 값을 확인해주세요.',
      {
        details: {
          year: kv.get('year'),
          schemaVersion: kv.get('schemaVersion'),
        },
      },
    )
  }

  if (schemaVersion !== 1) {
    throw new AppError(
      'UNSUPPORTED_SCHEMA',
      '이 가계부는 다른 데이터 형식을 사용하고 있습니다. Sheet 구조 업데이트가 필요합니다.',
      { details: { schemaVersion } },
    )
  }

  if (!Number.isInteger(budgetStartMonth) || budgetStartMonth < 1 || budgetStartMonth > 12) {
    throw new AppError(
      'INVALID_CONFIG',
      '앱설정의 예산 시작 월을 확인해주세요.',
      { details: { budgetStartMonth: kv.get('budgetStartMonth') } },
    )
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    year,
    schemaVersion,
    budgetStartMonth,
    environment: kv.get('environment') || undefined,
    previousSpreadsheetId: kv.get('previousSpreadsheetId') || undefined,
    nextSpreadsheetId: kv.get('nextSpreadsheetId') || undefined,
    createdAt: kv.get('createdAt') || undefined,
    updatedAt: kv.get('updatedAt') || undefined,
  }
}
