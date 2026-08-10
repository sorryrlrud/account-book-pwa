import { toIsoDateInKst } from '@/utils/date.ts'

export function toDateInputValue(date: Date) {
  const year = date.getUTCFullYear()
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateInput(value: string) {
  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

export function shiftDate(value: string, step: number) {
  const date = parseDateInput(value) ?? new Date(`${toIsoDateInKst()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + step)
  return toDateInputValue(date)
}

export function formatDateHeading(value: string) {
  const date = parseDateInput(value)
  if (!date) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
}

export function formatMonthLabel(value: string) {
  const [yearText, monthText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return value
  }

  return `${year}년 ${month}월`
}

export function currentMonthValue(date = new Date()) {
  return toIsoDateInKst(date).slice(0, 7)
}

export function shiftMonth(value: string, step: number) {
  const [yearText, monthText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const today = toIsoDateInKst().split('-').map(Number)
  const date = new Date(Date.UTC(
    Number.isInteger(year) ? year : today[0],
    Number.isInteger(month) ? month - 1 : today[1] - 1,
    1,
  ))
  date.setUTCMonth(date.getUTCMonth() + step)
  return toDateInputValue(date).slice(0, 7)
}
