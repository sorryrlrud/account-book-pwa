import type { Account } from '@/domain/account.ts'
import type { BudgetGroup, MonthlyBudgetSource } from '@/domain/budget.ts'
import type { Category } from '@/domain/category.ts'
import type { SheetsValueRange } from '@/services/sheets/sheetsClient.ts'
import { normalizeBooleanCell, parseSheetNumber, trimCell } from '@/utils/format.ts'

export function parseAccounts(range: SheetsValueRange): Account[] {
  return (range.values ?? [])
    .slice(1)
    .map((row) => ({
      name: trimCell(row[0]),
      active: normalizeBooleanCell(row[1]),
      assetGroup: trimCell(row[2]) || undefined,
      order: parseSheetNumber(row[3]),
    }))
    .filter((account) => account.name)
    .sort((left, right) => left.order - right.order)
}

export function parseCategories(range: SheetsValueRange): Category[] {
  return (range.values ?? [])
    .slice(1)
    .map((row) => ({
      name: trimCell(row[0]),
      active: normalizeBooleanCell(row[1]),
      budgetGroup: trimCell(row[2]) || undefined,
      order: parseSheetNumber(row[3]),
    }))
    .filter((category) => category.name)
    .sort((left, right) => left.order - right.order)
}

export function parseBudgetGroups(range: SheetsValueRange): BudgetGroup[] {
  return (range.values ?? [])
    .slice(1)
    .map((row) => ({
      name: trimCell(row[0]),
      baseMonthlyBudget: parseSheetNumber(row[1]),
      startMonth: parseSheetNumber(row[4]) || 1,
      active: normalizeBooleanCell(row[2]),
      order: parseSheetNumber(row[3]),
    }))
    .filter((group) => group.name)
    .sort((left, right) => left.order - right.order)
}

export function parseMonthlyBudgetSources(range: SheetsValueRange): MonthlyBudgetSource[] {
  return (range.values ?? [])
    .slice(1)
    .map((row) => ({
      month: parseSheetNumber(row[0]),
      groupName: trimCell(row[1]),
      baseSnapshot: parseSheetNumber(row[2]),
      adjustment: parseSheetNumber(row[3]),
    }))
    .filter((source) => source.month >= 0 && source.month <= 12 && source.groupName)
}
