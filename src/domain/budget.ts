import type { Category } from './category.ts'
import type { Transaction } from './transaction.ts'

export interface BudgetGroup {
  name: string
  baseMonthlyBudget: number
  startMonth: number
  active: boolean
  order: number
}

export interface BudgetGroupMutation {
  name: string
  baseMonthlyBudget: number
  startMonth: number
}

export interface MonthlyBudgetSource {
  month: number
  groupName: string
  baseSnapshot: number
  adjustment: number
  settledCarryOver?: number
}

export interface MonthlyBudget {
  year: number
  month: number
  groupName: string
  baseSnapshot: number
  allocatedBudget: number
  carryOver: number
  adjustment: number
  effectiveBudget: number
  spent: number
  remaining: number
  settledCarryOver?: number
  nextMonthExpected: number
}

export interface BudgetPlanGroupMutation {
  name: string
  allocatedBudget: number
}

export interface BudgetPlanMutation {
  maximumBudget: number
  groups: BudgetPlanGroupMutation[]
}

export interface BudgetSettlementGroupMutation {
  name: string
  carryOver: number
}

export interface BudgetSettlementMutation {
  groups: BudgetSettlementGroupMutation[]
}

export const MONTHLY_BUDGET_LIMIT_GROUP = '__MONTHLY_BUDGET_LIMIT__'

export interface BudgetSummary {
  group: BudgetGroup
  monthly: MonthlyBudget
}

export interface BudgetComputationInput {
  year: number
  month: number
  groups: BudgetGroup[]
  categories: Category[]
  monthlySources: MonthlyBudgetSource[]
  transactions: Transaction[]
  budgetStartMonth?: number
}

export function calculateMonthlyBudgets(
  input: BudgetComputationInput,
): MonthlyBudget[] {
  const groupByCategory = new Map<string, string>()
  for (const category of input.categories) {
    if (category.budgetGroup) {
      groupByCategory.set(category.name, category.budgetGroup)
    }
  }

  const sourceByGroup = new Map<string, MonthlyBudgetSource>()
  const previousSourceByGroup = new Map<string, MonthlyBudgetSource>()
  const nextSourceByGroup = new Map<string, MonthlyBudgetSource>()
  for (const source of input.monthlySources) {
    if (source.month === input.month) {
      sourceByGroup.set(source.groupName, source)
    }
    if (source.month === input.month - 1) {
      previousSourceByGroup.set(source.groupName, source)
    }
    if (source.month === input.month + 1) {
      nextSourceByGroup.set(source.groupName, source)
    }
  }

  const spentByGroup = new Map<string, number>()
  for (const transaction of input.transactions) {
    if (
      (transaction.type !== 'expense' && transaction.type !== 'income') ||
      !transaction.category
    ) {
      continue
    }

    const groupName = groupByCategory.get(transaction.category)
    if (!groupName) {
      continue
    }

    const current = spentByGroup.get(groupName) ?? 0
    const amount = Math.abs(transaction.amount)
    spentByGroup.set(
      groupName,
      current + (transaction.type === 'expense' ? amount : -amount),
    )
  }

  const results: MonthlyBudget[] = []
  for (const group of [...input.groups].sort((left, right) => left.order - right.order)) {
    const groupStartMonth = Math.max(input.budgetStartMonth ?? 1, group.startMonth)
    if (!group.active || input.month < groupStartMonth) {
      continue
    }
    const source = sourceByGroup.get(group.name)
    const baseSnapshot = source?.baseSnapshot ?? group.baseMonthlyBudget
    const adjustment = source?.adjustment ?? 0
    const allocatedBudget = baseSnapshot + adjustment
    const carryOver = input.month === groupStartMonth && groupStartMonth > 1
      ? 0
      : (previousSourceByGroup.get(group.name)?.settledCarryOver ?? 0)
    const spent = spentByGroup.get(group.name) ?? 0
    const effectiveBudget = allocatedBudget + carryOver
    const remaining = effectiveBudget - spent
    const nextSource = nextSourceByGroup.get(group.name)
    const nextAllocatedBudget = nextSource
      ? nextSource.baseSnapshot + nextSource.adjustment
      : group.baseMonthlyBudget

    results.push({
      year: input.year,
      month: input.month,
      groupName: group.name,
      baseSnapshot,
      allocatedBudget,
      carryOver,
      adjustment,
      effectiveBudget,
      spent,
      remaining,
      settledCarryOver: source?.settledCarryOver,
      nextMonthExpected: nextAllocatedBudget + (source?.settledCarryOver ?? 0),
    })
  }

  return results
}

export function buildBudgetTimeline(
  year: number,
  groups: BudgetGroup[],
  categories: Category[],
  monthlySources: MonthlyBudgetSource[],
  transactionsByMonth: Map<number, Transaction[]>,
  budgetStartMonth = 1,
): MonthlyBudget[] {
  const timeline: MonthlyBudget[] = []
  const months = new Set<number>()

  for (const source of monthlySources) {
    if (source.month >= 1 && source.month <= 12) {
      months.add(source.month)
    }
  }

  for (const month of transactionsByMonth.keys()) {
    if (month >= 1 && month <= 12) {
      months.add(month)
    }
  }

  const orderedMonths = [...months].sort((left, right) => left - right)
  for (const month of orderedMonths) {
    const monthTransactions = transactionsByMonth.get(month) ?? []
    const monthBudgets = calculateMonthlyBudgets({
      year,
      month,
      groups,
      categories,
      monthlySources,
      transactions: monthTransactions,
      budgetStartMonth,
    })

    for (const monthlyBudget of monthBudgets) {
      timeline.push(monthlyBudget)
    }
  }

  return timeline
}
