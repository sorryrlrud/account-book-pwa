const currencyFormatter = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 0,
})

export function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`
}

export function formatCurrency(value: number): string {
  return `${currencyFormatter.format(value)}원`
}

export function formatSignedCurrency(value: number): string {
  if (value > 0) {
    return `+${formatCurrency(value)}`
  }

  if (value < 0) {
    return `-${formatCurrency(Math.abs(value))}`
  }

  return formatCurrency(0)
}
