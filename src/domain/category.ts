export interface Category {
  name: string
  active: boolean
  budgetGroup?: string
  order: number
}

export interface CategoryMutation {
  name: string
  budgetGroup?: string
}
