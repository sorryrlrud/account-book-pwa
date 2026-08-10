const KST_OFFSET_MS = 9 * 60 * 60 * 1000

export function toKstDateParts(date = new Date()): {
  year: number
  month: number
  day: number
} {
  const kstTime = new Date(date.getTime() + KST_OFFSET_MS)
  return {
    year: kstTime.getUTCFullYear(),
    month: kstTime.getUTCMonth() + 1,
    day: kstTime.getUTCDate(),
  }
}

export function toIsoDateInKst(date = new Date()): string {
  const { year, month, day } = toKstDateParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseLedgerDate(value: string): string {
  const normalized = value.trim()
  const dateMatch = normalized.match(
    /^(\d{2,4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})\s*\.?$/,
  )
  if (!dateMatch) {
    throw new Error(`Invalid ledger date: ${value}`)
  }

  const rawYear = Number(dateMatch[1])
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid ledger date: ${value}`)
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getYearMonthFromDate(date: string): { year: number; month: number } {
  const normalized = parseLedgerDate(date)
  return {
    year: Number(normalized.slice(0, 4)),
    month: Number(normalized.slice(5, 7)),
  }
}

export function assertMonth(month: number): void {
  if (!Number.isInteger(month) || month < 0 || month > 12) {
    throw new Error(`Invalid month: ${month}`)
  }
}
