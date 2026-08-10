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

export function formatAmountPreview(value: string) {
  if (!value) {
    return '₩0'
  }

  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    return '₩0'
  }

  return formatKrw(amount)
}
