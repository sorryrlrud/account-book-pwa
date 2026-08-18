import type { Category } from './category.ts'
import type { Transaction } from './transaction.ts'

export interface BudgetGroup {
  name: string
  baseMonthlyBudget: number
  active: boolean
  order: number
}

export interface BudgetGroupMutation {
  name: string
  baseMonthlyBudget: number
}

export interface MonthlyBudgetSource {
  month: number
  groupName: string
  baseSnapshot: number
  adjustment: number
}

export interface MonthlyBudget {
  year: number
  month: number
  groupName: string
  baseSnapshot: number
  carryOver: number
  adjustment: number
  effectiveBudget: number
  spent: number
  remaining: number
  nextMonthExpected: number
}

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
  monthZeroCarryOvers?: Record<string, number>
  carryOvers?: Record<string, number>
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
  for (const source of input.monthlySources) {
    if (source.month === input.month) {
      sourceByGroup.set(source.groupName, source)
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
    const source = sourceByGroup.get(group.name)
    const baseSnapshot = source?.baseSnapshot ?? group.baseMonthlyBudget
    const adjustment = source?.adjustment ?? 0
    const carryOver = input.carryOvers?.[group.name]
      ?? (input.month === 1
        ? (input.monthZeroCarryOvers?.[group.name] ?? 0)
        : 0)
    const spent = spentByGroup.get(group.name) ?? 0
    const effectiveBudget = baseSnapshot + carryOver + adjustment
    const remaining = effectiveBudget - spent

    results.push({
      year: input.year,
      month: input.month,
      groupName: group.name,
      baseSnapshot,
      carryOver,
      adjustment,
      effectiveBudget,
      spent,
      remaining,
      nextMonthExpected: group.baseMonthlyBudget + remaining,
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
  monthZeroCarryOvers?: Record<string, number>,
): MonthlyBudget[] {
  const timeline: MonthlyBudget[] = []
  const carryOverByGroup = new Map<string, number>(Object.entries(monthZeroCarryOvers ?? {}))
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
  let previousMonth: number | undefined

  for (const month of orderedMonths) {
    if (previousMonth !== undefined && month - previousMonth > 1) {
      carryOverByGroup.clear()
    }

    const monthTransactions = transactionsByMonth.get(month) ?? []
    const monthBudgets = calculateMonthlyBudgets({
      year,
      month,
        groups,
        categories,
        monthlySources,
        transactions: monthTransactions,
        monthZeroCarryOvers: Object.fromEntries(carryOverByGroup),
        carryOvers: Object.fromEntries(carryOverByGroup),
      })

    for (const monthlyBudget of monthBudgets) {
      timeline.push(monthlyBudget)
      carryOverByGroup.set(monthlyBudget.groupName, monthlyBudget.remaining)
    }

    previousMonth = month
  }

  return timeline
}

export function resetCarryOverAdjustment(currentCarryOver: number): number {
  return -currentCarryOver
}
