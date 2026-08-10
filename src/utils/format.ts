export function parseSheetNumber(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return value
  }

  if (!value) {
    return 0
  }

  const normalized = String(value).replaceAll(',', '').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeBooleanCell(value: string | undefined): boolean {
  return value?.trim().toUpperCase() === 'TRUE'
}

export function trimCell(value: string | undefined): string {
  return value?.trim() ?? ''
}

export function toUserEnteredLiteral(value: string): string {
  return /^[=+@-]/.test(value) ? `'${value}` : value
}
