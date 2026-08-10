export interface SheetRowRef {
  rowIndex: number
  rowNumber: number
}

export function buildRange(sheetName: string, range: string): string {
  return `'${sheetName}'!${range}`
}

export function toRowNumber(rowIndex: number): number {
  return rowIndex + 1
}

export function buildRowRange(sheetName: string, rowNumber: number, columns = 'A:Z'): string {
  const [startColumn, endColumn] = columns.split(':')
  return `'${sheetName}'!${startColumn}${rowNumber}:${endColumn}${rowNumber}`
}
