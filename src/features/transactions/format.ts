export function formatKrw(amount: number) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function toAmountInput(value: string) {
  return value.replaceAll(/[^0-9]/g, '')
}
