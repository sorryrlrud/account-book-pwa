export function parseSheetNumber(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (!value) {
    return 0
  }

  const source = String(value).trim()
  const hasOpeningParenthesis = source.includes('(')
  const hasClosingParenthesis = source.includes(')')
  if (hasOpeningParenthesis !== hasClosingParenthesis) {
    return 0
  }

  const isAccountingNegative = hasOpeningParenthesis && hasClosingParenthesis
  const normalized = source
    .replaceAll(/[\s,()]/g, '')
    .replaceAll(/[₩￦]/g, '')
    .replaceAll(/KRW/gi, '')
    .replaceAll('원', '')
    .replaceAll(/[−–—]/g, '-')

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return 0
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return isAccountingNegative ? -Math.abs(parsed) : parsed
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
