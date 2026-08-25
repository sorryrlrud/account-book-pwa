import type { Account, AccountBalance, AccountMutation } from '@/domain/account.ts'
import type {
  BudgetGroup,
  BudgetGroupMutation,
  BudgetPlanMutation,
  BudgetSettlementMutation,
  MonthlyBudget,
  MonthlyBudgetSource,
} from '@/domain/budget.ts'
import type { Category, CategoryMutation } from '@/domain/category.ts'
import type { EnergySummary } from '@/domain/energy.ts'
import type { InvestmentSummary } from '@/domain/investment.ts'
import type { SettlementSummary } from '@/domain/settlement.ts'
import type {
  SavedTransactionResult,
  Transaction,
  TransactionDraft,
  TransactionLookup,
} from '@/domain/transaction.ts'
import type { LinkedYear, YearConfig, YearGraph, YearLinkRequest } from '@/domain/year.ts'

export interface BootstrapResult {
  yearConfig: YearConfig
  yearGraph: YearGraph
}

export interface LedgerRepository {
  bootstrap(): Promise<BootstrapResult>
  verifyAccess(spreadsheetId: string): Promise<YearConfig>
  getYearGraph(): Promise<YearGraph>
  getMonthTransactions(year: number, month: number): Promise<Transaction[]>
  getAccountBalances(year: number, month: number): Promise<AccountBalance[]>
  appendTransaction(draft: TransactionDraft): Promise<SavedTransactionResult>
  updateTransaction(lookup: TransactionLookup, draft: TransactionDraft): Promise<SavedTransactionResult>
  deleteTransaction(lookup: TransactionLookup): Promise<void>
  getAccounts(year: number): Promise<Account[]>
  createAccount(year: number, input: AccountMutation): Promise<Account>
  renameAccount(year: number, previousName: string, nextName: string): Promise<void>
  disableAccount(year: number, name: string): Promise<void>
  getCategories(year: number): Promise<Category[]>
  createCategory(year: number, input: CategoryMutation): Promise<Category>
  renameCategory(year: number, previousName: string, nextName: string): Promise<void>
  disableCategory(year: number, name: string): Promise<void>
  getBudgetGroups(year: number): Promise<BudgetGroup[]>
  createBudgetGroup(year: number, input: BudgetGroupMutation): Promise<BudgetGroup>
  getMonthlyBudgetSources(year: number): Promise<MonthlyBudgetSource[]>
  getMonthlyBudgets(year: number, month: number): Promise<MonthlyBudget[]>
  getMonthlyBudgetMaximum(year: number, month: number): Promise<number | undefined>
  saveBudgetPlan(year: number, month: number, input: BudgetPlanMutation): Promise<void>
  saveBudgetSettlement(year: number, month: number, input: BudgetSettlementMutation): Promise<void>
  linkYear(request: YearLinkRequest): Promise<LinkedYear[]>
  syncMonthZero(year: number): Promise<void>
  getSettlement(year: number, month: number): Promise<SettlementSummary>
  getInvestmentSummary(year: number, month: number): Promise<InvestmentSummary>
  getEnergySummary(year: number, month: number): Promise<EnergySummary>
}
