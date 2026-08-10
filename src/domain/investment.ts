export interface InvestmentMetric {
  label: string
  value: string
}

export interface InvestmentSummary {
  year: number
  month: number
  metrics: InvestmentMetric[]
  allocation: InvestmentMetric[]
  warnings: string[]
}
