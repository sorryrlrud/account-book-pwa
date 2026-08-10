export interface YearConfig {
  spreadsheetId: string
  spreadsheetUrl: string
  year: number
  schemaVersion: number
  environment?: string
  previousSpreadsheetId?: string
  nextSpreadsheetId?: string
  createdAt?: string
  updatedAt?: string
}

export interface LinkedYear {
  year: number
  spreadsheetId: string
  connected: boolean
}

export interface YearLinkRequest {
  year: number
  spreadsheetUrl: string
}

export interface YearGraph {
  bootstrapSpreadsheetId: string
  years: Map<number, YearConfig>
}
