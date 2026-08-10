import type { EnergySummary } from '@/domain/energy.ts'
import type { InvestmentSummary } from '@/domain/investment.ts'
import type { SheetsValueRange } from '@/services/sheets/sheetsClient.ts'
import { trimCell } from '@/utils/format.ts'

const INVESTMENT_LABELS = ['잔고', '매입가', '평가금액', '현재가', '수익', '수익률']
const ENERGY_LABELS = ['관리비', '전기', '수도', '난방', '온수', '급탕', '취사', '태양광 발전량', '이월 발전량', '전력 상계', '기름']

function flattenRows(range: SheetsValueRange): string[][] {
  return range.values?.map((row) => row.map((cell) => trimCell(cell))) ?? []
}

export function parseInvestmentSummary(
  year: number,
  month: number,
  range: SheetsValueRange,
): InvestmentSummary {
  const rows = flattenRows(range)
  const labels = new Set(rows.flat())
  const warnings: string[] = []
  const missingLabels = INVESTMENT_LABELS.filter((label) => !labels.has(label))
  if (missingLabels.length > 0) {
    warnings.push('투자 Sheet 형식을 확인해주세요.')
  }

  const metrics = rows
    .filter((row) => row[0] && row[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }))

  const allocation = rows
    .filter((row) => row[2] && row[3])
    .slice(0, 10)
    .map(([, , label, value]) => ({ label, value }))

  return {
    year,
    month,
    metrics,
    allocation,
    warnings,
  }
}

export function parseEnergySummary(
  year: number,
  month: number,
  range: SheetsValueRange,
): EnergySummary {
  const rows = flattenRows(range)
  const warnings: string[] = []
  const labels = new Set(rows.flat())
  if (ENERGY_LABELS.every((label) => !labels.has(label))) {
    warnings.push('에너지 Sheet 형식을 확인해주세요.')
  }

  const metrics = rows
    .filter((row) => row[0] && (row[1] || row[2]))
    .slice(0, 12)
    .map(([label, usage, amount]) => ({
      label,
      usage: usage || undefined,
      amount: amount || undefined,
    }))

  return {
    year,
    month,
    metrics,
    warnings,
  }
}
