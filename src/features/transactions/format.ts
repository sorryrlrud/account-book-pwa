export function formatKrw(amount: number) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function toAmountInput(value: string) {
  const digits = value.replaceAll(/[^0-9]/g, '')
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

export function parseAmountInput(value: string) {
  return Number(value.replaceAll(',', ''))
}
