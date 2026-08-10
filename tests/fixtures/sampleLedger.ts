import type { BudgetGroup, MonthlyBudgetSource } from '@/domain/budget.ts'
import type { Category } from '@/domain/category.ts'
import type { Transaction } from '@/domain/transaction.ts'

export const sampleBudgetGroups: BudgetGroup[] = [
  {
    name: '생활비',
    baseMonthlyBudget: 1_500_000,
    active: true,
    order: 1,
  },
  {
    name: '반려동물',
    baseMonthlyBudget: 500_000,
    active: true,
    order: 2,
  },
]

export const sampleCategories: Category[] = [
  {
    name: '식비',
    active: true,
    budgetGroup: '생활비',
    order: 1,
  },
  {
    name: '관리',
    active: true,
    budgetGroup: '생활비',
    order: 2,
  },
  {
    name: '고냥',
    active: true,
    budgetGroup: '반려동물',
    order: 3,
  },
]

export function createExpenseTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    type: 'expense',
    date: '2026-08-10',
    amount: -100_000,
    description: '점심',
    account: '네페',
    category: '식비',
    sourceYear: 2026,
    sourceMonth: 8,
    ...overrides,
  }
}

export function createIncomeTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    type: 'income',
    date: '2026-08-10',
    amount: 5_900_000,
    description: '급여',
    account: '토스',
    category: '급여',
    sourceYear: 2026,
    sourceMonth: 8,
    ...overrides,
  }
}

export function createTransferTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    type: 'transfer',
    date: '2026-08-10',
    amount: -1_000_000,
    description: '생활비 이동',
    account: '토스',
    destinationAccount: '파킹',
    sourceYear: 2026,
    sourceMonth: 8,
    ...overrides,
  }
}

export const sampleMonthlySources: MonthlyBudgetSource[] = [
  {
    month: 1,
    groupName: '생활비',
    baseSnapshot: 1_500_000,
    adjustment: 0,
  },
  {
    month: 7,
    groupName: '생활비',
    baseSnapshot: 1_500_000,
    adjustment: 0,
  },
  {
    month: 8,
    groupName: '생활비',
    baseSnapshot: 1_500_000,
    adjustment: 0,
  },
  {
    month: 9,
    groupName: '생활비',
    baseSnapshot: 1_500_000,
    adjustment: 0,
  },
  {
    month: 8,
    groupName: '반려동물',
    baseSnapshot: 500_000,
    adjustment: 0,
  },
]
