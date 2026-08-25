export interface Account {
  name: string
  active: boolean
  assetGroup?: string
  order: number
}

export interface AccountBalance {
  account: string
  balance: number
}

export interface AccountMutation {
  name: string
  assetGroup?: string
}
