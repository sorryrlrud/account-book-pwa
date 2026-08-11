import { AppError } from '@/domain/errors.ts'
import { REQUIRED_CORE_SHEETS } from '@/services/sheets/schema.ts'
import type {
  AppendValuesResponse,
  SheetsSpreadsheet,
  SheetsValueRange,
} from '@/services/sheets/sheetsClient.ts'

interface SheetState {
  sheetId: number
  title: string
  values: string[][]
}

interface SpreadsheetState {
  spreadsheetId: string
  title: string
  sheets: Map<string, SheetState>
}

export interface WorkbookSeed {
  spreadsheetId: string
  year: number
  title?: string
  previousSpreadsheetId?: string
  nextSpreadsheetId?: string
  environment?: string
  createdAt?: string
  updatedAt?: string
  sheetValues?: Partial<Record<string, string[][]>>
}

interface ParsedRange {
  sheetName: string
  startColumn: number
  endColumn: number
  startRow?: number
  endRow?: number
}

export interface FakeSheetsClientOptions {
  stripTransactionIdsOnAppend?: boolean
  stripTransferIdsOnAppend?: boolean
}

export interface AppendCall {
  spreadsheetId: string
  range: string
  values: string[][]
}

export interface UpdateCall {
  spreadsheetId: string
  range: string
  values: string[][]
}

export interface BatchUpdateValuesCall {
  spreadsheetId: string
  data: Array<{ range: string; values: string[][] }>
}

export interface BatchUpdateCall {
  spreadsheetId: string
  requests: unknown[]
}

export class FakeSheetsClient {
  readonly appendCalls: AppendCall[] = []
  readonly updateCalls: UpdateCall[] = []
  readonly batchUpdateValuesCalls: BatchUpdateValuesCall[] = []
  readonly batchUpdateCalls: BatchUpdateCall[] = []

  readonly #spreadsheets = new Map<string, SpreadsheetState>()
  readonly #options: FakeSheetsClientOptions
  readonly #rangeFailures = new Map<string, Error>()

  failNextBatchUpdateValues?: Error
  failNextBatchUpdate?: Error

  constructor(workbooks: WorkbookSeed[], options: FakeSheetsClientOptions = {}) {
    this.#options = options
    for (const workbook of workbooks) {
      this.#spreadsheets.set(workbook.spreadsheetId, createWorkbookState(workbook))
    }
  }

  failRange(spreadsheetId: string, range: string, error: Error): void {
    this.#rangeFailures.set(this.#rangeKey(spreadsheetId, range), error)
  }

  getSheetValues(spreadsheetId: string, sheetName: string): string[][] {
    return cloneRows(this.#getSheet(spreadsheetId, sheetName).values)
  }

  async getSpreadsheet(spreadsheetId: string): Promise<SheetsSpreadsheet> {
    const spreadsheet = this.#getSpreadsheetState(spreadsheetId)
    return {
      spreadsheetId,
      properties: { title: spreadsheet.title },
      sheets: [...spreadsheet.sheets.values()].map((sheet) => ({
        properties: {
          sheetId: sheet.sheetId,
          title: sheet.title,
        },
      })),
    }
  }

  async getValues(spreadsheetId: string, range: string): Promise<SheetsValueRange> {
    this.#maybeFailRange(spreadsheetId, range)
    const parsed = parseRange(range)
    const sheet = this.#getSheet(spreadsheetId, parsed.sheetName)
    const startIndex = (parsed.startRow ?? 1) - 1
    const endIndex = parsed.endRow ?? sheet.values.length
    const values = sheet.values
      .slice(startIndex, endIndex)
      .map((row) => row.slice(parsed.startColumn, parsed.endColumn + 1))

    return {
      range,
      values: cloneRows(values),
    }
  }

  async batchGetValues(
    spreadsheetId: string,
    ranges: string[],
  ): Promise<{ valueRanges: SheetsValueRange[] }> {
    return {
      valueRanges: await Promise.all(ranges.map((range) => this.getValues(spreadsheetId, range))),
    }
  }

  async appendValues(
    spreadsheetId: string,
    range: string,
    values: string[][],
  ): Promise<AppendValuesResponse> {
    const parsed = parseRange(range)
    const sheet = this.#getSheet(spreadsheetId, parsed.sheetName)
    const startRow = sheet.values.length + 1
    const storedRows = cloneRows(values).map((row) => {
      const nextRow = cloneRow(row)
      if (this.#options.stripTransactionIdsOnAppend && row[23] !== 'transfer') {
        nextRow[24] = ''
      }
      if (this.#options.stripTransferIdsOnAppend && row[23] === 'transfer') {
        nextRow[25] = ''
      }
      return nextRow
    })

    sheet.values.push(...storedRows)
    const endRow = sheet.values.length
    this.appendCalls.push({
      spreadsheetId,
      range,
      values: cloneRows(values),
    })

    return {
      updates: {
        updatedRange: `'${parsed.sheetName}'!${toColumnName(parsed.startColumn)}${startRow}:${toColumnName(parsed.endColumn)}${endRow}`,
        updatedRows: values.length,
      },
    }
  }

  async updateValues(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    this.updateCalls.push({
      spreadsheetId,
      range,
      values: cloneRows(values),
    })
    this.#applyUpdate(spreadsheetId, range, values)
  }

  async batchUpdateValues(
    spreadsheetId: string,
    data: Array<{ range: string; values: string[][] }>,
  ): Promise<void> {
    this.batchUpdateValuesCalls.push({
      spreadsheetId,
      data: data.map((item) => ({
        range: item.range,
        values: cloneRows(item.values),
      })),
    })

    if (this.failNextBatchUpdateValues) {
      const error = this.failNextBatchUpdateValues
      this.failNextBatchUpdateValues = undefined
      throw error
    }

    for (const item of data) {
      this.#applyUpdate(spreadsheetId, item.range, item.values)
    }
  }

  async batchUpdate(spreadsheetId: string, requests: unknown[]): Promise<void> {
    this.batchUpdateCalls.push({
      spreadsheetId,
      requests: structuredClone(requests),
    })

    if (this.failNextBatchUpdate) {
      const error = this.failNextBatchUpdate
      this.failNextBatchUpdate = undefined
      throw error
    }

    const spreadsheet = this.#getSpreadsheetState(spreadsheetId)
    for (const request of requests) {
      const deleteDimension = asDeleteDimensionRequest(request)
      if (!deleteDimension) {
        continue
      }

      const sheet = [...spreadsheet.sheets.values()].find(
        (candidate) => candidate.sheetId === deleteDimension.range.sheetId,
      )
      if (!sheet) {
        throw new AppError('SCHEMA_MISMATCH', '월별 Sheet를 찾지 못했습니다.')
      }

      const startIndex = deleteDimension.range.startIndex
      const endIndex = deleteDimension.range.endIndex
      sheet.values.splice(startIndex, endIndex - startIndex)
    }
  }

  async clearValues(spreadsheetId: string, range: string): Promise<void> {
    const parsed = parseRange(range)
    const sheet = this.#getSheet(spreadsheetId, parsed.sheetName)
    const startRow = parsed.startRow ?? 1
    const endRow = parsed.endRow ?? sheet.values.length
    while (sheet.values.length < endRow) {
      sheet.values.push([])
    }
    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
      const row = sheet.values[rowNumber - 1] ?? []
      for (let column = parsed.startColumn; column <= parsed.endColumn; column += 1) {
        row[column] = ''
      }
      sheet.values[rowNumber - 1] = row
    }
  }

  #applyUpdate(spreadsheetId: string, range: string, values: string[][]): void {
    const parsed = parseRange(range)
    const sheet = this.#getSheet(spreadsheetId, parsed.sheetName)
    const startRow = parsed.startRow ?? 1
    const endRow = parsed.endRow ?? (startRow + values.length - 1)
    while (sheet.values.length < endRow) {
      sheet.values.push([])
    }
    for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
      const targetIndex = startRow - 1 + rowIndex
      const nextRow = cloneRow(sheet.values[targetIndex] ?? [])
      const sourceRow = values[rowIndex] ?? []
      for (let columnOffset = 0; columnOffset < sourceRow.length; columnOffset += 1) {
        nextRow[parsed.startColumn + columnOffset] = sourceRow[columnOffset]
      }
      sheet.values[targetIndex] = nextRow
    }
  }

  #rangeKey(spreadsheetId: string, range: string): string {
    return `${spreadsheetId}::${range}`
  }

  #maybeFailRange(spreadsheetId: string, range: string): void {
    const error = this.#rangeFailures.get(this.#rangeKey(spreadsheetId, range))
    if (!error) {
      return
    }

    throw error
  }

  #getSpreadsheetState(spreadsheetId: string): SpreadsheetState {
    const spreadsheet = this.#spreadsheets.get(spreadsheetId)
    if (!spreadsheet) {
      throw new AppError('NOT_FOUND', `Unknown spreadsheet: ${spreadsheetId}`)
    }

    return spreadsheet
  }

  #getSheet(spreadsheetId: string, sheetName: string): SheetState {
    const spreadsheet = this.#getSpreadsheetState(spreadsheetId)
    const sheet = spreadsheet.sheets.get(sheetName)
    if (!sheet) {
      throw new AppError('SCHEMA_MISMATCH', `Unknown sheet: ${sheetName}`)
    }

    return sheet
  }
}

function toColumnName(columnIndex: number): string {
  let current = columnIndex + 1
  let result = ''
  while (current > 0) {
    const remainder = (current - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    current = Math.floor((current - 1) / 26)
  }
  return result
}

export function createLedgerWorkbook(seed: WorkbookSeed): WorkbookSeed {
  return seed
}

export function buildTransactionRow(input: {
  date: string
  amount: number
  description: string
  account: string
  category?: string
  type?: string
  transactionId?: string
  transferId?: string
}): string[] {
  const row = new Array<string>(26).fill('')
  row[0] = input.date
  row[1] = String(input.amount)
  row[2] = input.description
  row[3] = input.account
  row[4] = input.category ?? ''
  row[23] = input.type ?? ''
  row[24] = input.transactionId ?? ''
  row[25] = input.transferId ?? ''
  return row
}

function createWorkbookState(seed: WorkbookSeed): SpreadsheetState {
  const title = seed.title ?? `${seed.year} Ledger`
  const sheets = new Map<string, SheetState>()
  let sheetId = 100

  for (const requiredSheet of REQUIRED_CORE_SHEETS) {
    sheets.set(requiredSheet, {
      sheetId,
      title: requiredSheet,
      values: cloneRows(defaultSheetValues(requiredSheet, seed)),
    })
    sheetId += 1
  }

  for (const [sheetName, values] of Object.entries(seed.sheetValues ?? {})) {
    const existing = sheets.get(sheetName)
    if (existing) {
      existing.values = cloneRows(values ?? [])
      continue
    }

    sheets.set(sheetName, {
      sheetId,
      title: sheetName,
      values: cloneRows(values ?? []),
    })
    sheetId += 1
  }

  return {
    spreadsheetId: seed.spreadsheetId,
    title,
    sheets,
  }
}

function defaultSheetValues(sheetName: string, seed: WorkbookSeed): string[][] {
  if (sheetName === '앱설정') {
    return [
      ['key', 'value'],
      ['year', String(seed.year)],
      ['schemaVersion', '1'],
      ['environment', seed.environment ?? 'TEST'],
      ['previousSpreadsheetId', seed.previousSpreadsheetId ?? ''],
      ['nextSpreadsheetId', seed.nextSpreadsheetId ?? ''],
      ['createdAt', seed.createdAt ?? '2026-01-01T00:00:00.000Z'],
      ['updatedAt', seed.updatedAt ?? '2026-01-01T00:00:00.000Z'],
    ]
  }

  if (sheetName === '통장') {
    return [
      ['name', 'active', 'assetGroup', 'order'],
      ['Checking', 'FALSE', 'cash', '1'],
      ['Savings', 'TRUE', 'cash', '2'],
    ]
  }

  if (sheetName === '카테고리') {
    return [
      ['name', 'active', 'budgetGroup', 'order'],
      ['Food', 'FALSE', 'Living', '1'],
      ['Bills', 'TRUE', 'Living', '2'],
    ]
  }

  if (sheetName === '예산그룹') {
    return [
      ['name', 'baseMonthlyBudget', 'active', 'order'],
      ['Living', '1000000', 'TRUE', '1'],
    ]
  }

  if (sheetName === '예산월별') {
    return [
      ['month', 'groupName', 'baseSnapshot', 'adjustment'],
      ['0', 'Living', '1000000', '0'],
      ['1', 'Living', '1000000', '0'],
      ['8', 'Living', '1000000', '0'],
      ['12', 'Living', '1000000', '0'],
    ]
  }

  if (/^\d+$/.test(sheetName)) {
    return [[]]
  }

  return [[]]
}

function parseRange(range: string): ParsedRange {
  const match = range.match(/^'([^']+)'!([A-Z]+)(\d+)?(?::([A-Z]+)?(\d+)?)?$/)
  if (!match) {
    throw new Error(`Unsupported range: ${range}`)
  }

  return {
    sheetName: match[1],
    startColumn: columnToIndex(match[2]),
    endColumn: columnToIndex(match[4] ?? match[2]),
    startRow: match[3] ? Number(match[3]) : undefined,
    endRow: match[5] ? Number(match[5]) : match[3] ? Number(match[3]) : undefined,
  }
}

function columnToIndex(column: string): number {
  return [...column].reduce(
    (value, character) => value * 26 + character.charCodeAt(0) - 64,
    0,
  ) - 1
}

function asDeleteDimensionRequest(request: unknown): {
  range: {
    sheetId: number
    startIndex: number
    endIndex: number
  }
} | null {
  if (!request || typeof request !== 'object' || !('deleteDimension' in request)) {
    return null
  }

  const deleteDimension = request.deleteDimension
  if (!deleteDimension || typeof deleteDimension !== 'object' || !('range' in deleteDimension)) {
    return null
  }

  const range = deleteDimension.range as Record<string, unknown>
  if (
    !range ||
    typeof range !== 'object' ||
    typeof range['sheetId'] !== 'number' ||
    typeof range['startIndex'] !== 'number' ||
    typeof range['endIndex'] !== 'number'
  ) {
    return null
  }

  return {
    range: {
      sheetId: range['sheetId'],
      startIndex: range['startIndex'],
      endIndex: range['endIndex'],
    },
  }
}

function cloneRow(row: string[]): string[] {
  return [...row]
}

function cloneRows(rows: string[][]): string[][] {
  return rows.map((row) => cloneRow(row))
}
