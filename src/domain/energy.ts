export interface EnergyMetric {
  label: string
  usage?: string
  amount?: string
}

export interface EnergySummary {
  year: number
  month: number
  metrics: EnergyMetric[]
  warnings: string[]
}
