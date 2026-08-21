import { describe, expect, it } from 'vitest'
import {
  buildBudgetTimeline,
  calculateMonthlyBudgets,
} from './budget.ts'
import {
  createExpenseTransaction,
  createIncomeTransaction,
  createTransferTransaction,
  sampleBudgetGroups,
  sampleCategories,
  sampleMonthlySources,
} from '../../tests/fixtures/sampleLedger.ts'

describe('budget domain helpers', () => {
  it('carries over the previous month remainder into the next month timeline', () => {
    const transactionsByMonth = new Map<number, ReturnType<typeof createExpenseTransaction>[]>([
      [7, [createExpenseTransaction({ sourceMonth: 7, amount: -1_000_000 })]],
      [8, []],
    ])

    const timeline = buildBudgetTimeline(
      2026,
      sampleBudgetGroups,
      sampleCategories,
      sampleMonthlySources,
      transactionsByMonth,
    )

    const augustLiving = timeline.find(
      (budget) => budget.month === 8 && budget.groupName === '생활비',
    )

    expect(augustLiving).toMatchObject({
      carryOver: 500_000,
      effectiveBudget: 2_000_000,
      remaining: 2_000_000,
      nextMonthExpected: 3_500_000,
    })
  })

  it('keeps negative overage in the next month carry-over', () => {
    const transactionsByMonth = new Map<number, ReturnType<typeof createExpenseTransaction>[]>([
      [7, [createExpenseTransaction({ sourceMonth: 7, amount: -1_000_000 })]],
      [8, [createExpenseTransaction({ sourceMonth: 8, amount: -2_300_000 })]],
      [9, []],
    ])

    const timeline = buildBudgetTimeline(
      2026,
      sampleBudgetGroups,
      sampleCategories,
      sampleMonthlySources,
      transactionsByMonth,
    )

    const augustLiving = timeline.find(
      (budget) => budget.month === 8 && budget.groupName === '생활비',
    )
    const septemberLiving = timeline.find(
      (budget) => budget.month === 9 && budget.groupName === '생활비',
    )

    expect(augustLiving).toMatchObject({
      effectiveBudget: 2_000_000,
      spent: 2_300_000,
      remaining: -300_000,
    })
    expect(septemberLiving).toMatchObject({
      carryOver: -300_000,
      effectiveBudget: 1_200_000,
      remaining: 1_200_000,
    })
  })

  it('folds legacy manual adjustments into the allocated budget', () => {
    const budgets = calculateMonthlyBudgets({
      year: 2026,
      month: 8,
      groups: [
        {
          name: '생활비',
          baseMonthlyBudget: 5_000_000,
          active: true,
          order: 1,
        },
      ],
      categories: sampleCategories,
      monthlySources: [
        {
          month: 8,
          groupName: '생활비',
          baseSnapshot: 5_000_000,
          adjustment: -3_000_000,
        },
      ],
      transactions: [],
    })

    expect(budgets[0]).toMatchObject({
      baseSnapshot: 5_000_000,
      adjustment: -3_000_000,
      allocatedBudget: 2_000_000,
      effectiveBudget: 2_000_000,
      remaining: 2_000_000,
      nextMonthExpected: 7_000_000,
    })
  })

  it('uses 0-month carry-over for january calculations', () => {
    const budgets = calculateMonthlyBudgets({
      year: 2027,
      month: 1,
      groups: sampleBudgetGroups,
      categories: sampleCategories,
      monthlySources: sampleMonthlySources,
      transactions: [],
      monthZeroCarryOvers: {
        생활비: -30_000,
      },
    })

    const januaryLiving = budgets.find((budget) => budget.groupName === '생활비')
    expect(januaryLiving).toMatchObject({
      carryOver: -30_000,
      effectiveBudget: 1_470_000,
      remaining: 1_470_000,
    })
  })

  it('calculates net spending from categorized expenses and incomes', () => {
    const budgets = calculateMonthlyBudgets({
      year: 2026,
      month: 8,
      groups: sampleBudgetGroups,
      categories: sampleCategories,
      monthlySources: sampleMonthlySources,
      transactions: [
        createExpenseTransaction({ amount: -24_000, category: '식비' }),
        createIncomeTransaction({ amount: 4_000, category: '식비' }),
        createIncomeTransaction({ amount: 10_000, category: '급여' }),
        createTransferTransaction(),
        createExpenseTransaction({ amount: -50_000, category: undefined }),
      ],
    })

    const living = budgets.find((budget) => budget.groupName === '생활비')
    expect(living).toMatchObject({
      spent: 20_000,
      remaining: 1_480_000,
    })
  })

  it('does not include inactive budget categories', () => {
    const budgets = calculateMonthlyBudgets({
      year: 2026,
      month: 8,
      groups: sampleBudgetGroups.map((group) => ({ ...group, active: false })),
      categories: sampleCategories,
      monthlySources: sampleMonthlySources,
      transactions: [],
    })

    expect(budgets).toEqual([])
  })
})
