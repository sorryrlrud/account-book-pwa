export interface AccountSettlement {
  account: string
  previousMonthBalance: number
  currentMonthBalance: number
  delta: number
}

export interface SettlementSummary {
  year: number
  month: number
  income: number
  expense: number
  accounts: AccountSettlement[]
}
