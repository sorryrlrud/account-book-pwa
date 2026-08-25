import { createContext } from 'react'
import type { Account, AccountBalance, AccountMutation } from '@/domain/account.ts'
import type {
  BudgetGroup,
  BudgetGroupMutation,
  BudgetPlanMutation,
  BudgetSettlementMutation,
  MonthlyBudget,
} from '@/domain/budget.ts'
import type { Category, CategoryMutation } from '@/domain/category.ts'
import type { AppErrorCode } from '@/domain/errors.ts'
import type { EnergySummary } from '@/domain/energy.ts'
import type { InvestmentSummary } from '@/domain/investment.ts'
import type { SettlementSummary } from '@/domain/settlement.ts'
import type {
  SavedTransactionResult,
  Transaction,
  TransactionDraft,
  TransactionType,
} from '@/domain/transaction.ts'
import type {
  LinkedYear,
  YearConfig,
  YearGraph,
  YearLinkRequest,
} from '@/domain/year.ts'

export interface TransactionReferenceData {
  accounts: string[]
  categories: string[]
}

export interface HistoryFilters {
  month: string
  search: string
  type: 'all' | TransactionType
  account: string
  category: string
}

export type AppAuthStatus =
  | 'unconfigured'
  | 'signed_out'
  | 'authenticating'
  | 'bootstrapping'
  | 'ready'
  | 'auth_expired'
  | 'access_denied'
  | 'network_error'
  | 'unavailable'

export interface AppAuthState {
  status: AppAuthStatus
  message: string
  isBusy: boolean
  isAuthenticated: boolean
  canRead: boolean
  canWrite: boolean
  requiresLogin: boolean
  errorCode?: AppErrorCode
}

export interface SettingsData {
  year: number
  yearConfig: YearConfig
  linkedYears: LinkedYear[]
  accounts: Account[]
  categories: Category[]
  budgetGroups: BudgetGroup[]
}

export interface AppServiceState {
  readonly isConfigured: boolean
  readonly statusLabel: string
  readonly auth: AppAuthState
  readonly currentYear: number
  readonly currentMonth: number
  readonly hasWriteAccess: boolean
}

export interface AppService extends AppServiceState {
  login(): Promise<void>
  relogin(): Promise<void>
  logout(): Promise<void>
  bootstrap(): Promise<void>
  setCurrentYearMonth(year: number, month: number): void
  getReferenceData(year?: number): Promise<TransactionReferenceData>
  listTransactions(filters: HistoryFilters): Promise<Transaction[]>
  getAccountBalances(year: number, month: number): Promise<AccountBalance[]>
  saveTransaction(draft: TransactionDraft): Promise<SavedTransactionResult>
  updateTransaction(
    transaction: Transaction,
    draft: TransactionDraft,
  ): Promise<SavedTransactionResult>
  deleteTransaction(transaction: Transaction): Promise<void>
  getBudgets(year: number, month: number): Promise<MonthlyBudget[]>
  getBudgetMaximum(year: number, month: number): Promise<number | undefined>
  saveBudgetPlan(year: number, month: number, input: BudgetPlanMutation): Promise<void>
  saveBudgetSettlement(year: number, month: number, input: BudgetSettlementMutation): Promise<void>
  getSettingsData(year: number): Promise<SettingsData>
  createBudgetGroup(year: number, input: BudgetGroupMutation): Promise<BudgetGroup>
  createAccount(year: number, input: AccountMutation): Promise<Account>
  renameAccount(year: number, previousName: string, nextName: string): Promise<void>
  disableAccount(year: number, name: string): Promise<void>
  createCategory(year: number, input: CategoryMutation): Promise<Category>
  renameCategory(year: number, previousName: string, nextName: string): Promise<void>
  disableCategory(year: number, name: string): Promise<void>
  getYearGraph(): Promise<YearGraph>
  linkYear(request: YearLinkRequest): Promise<LinkedYear[]>
  syncMonthZero(year: number): Promise<void>
  getSettlement(year: number, month: number): Promise<SettlementSummary>
  getInvestment(year: number, month: number): Promise<InvestmentSummary>
  getEnergy(year: number, month: number): Promise<EnergySummary>
  openGoogleSheet(year?: number): void
}

const UNCONFIGURED_MESSAGE =
  'Google Sheet 연결이 아직 설정되지 않아 쓰기 작업을 완료할 수 없습니다.'

const defaultAuthState: AppAuthState = {
  status: 'unconfigured',
  message: 'Google Sheet 연결 설정이 필요합니다.',
  isBusy: false,
  isAuthenticated: false,
  canRead: false,
  canWrite: false,
  requiresLogin: false,
  errorCode: 'CONFIG_MISSING',
}

class UnconfiguredAppService implements AppService {
  readonly isConfigured = false
  readonly statusLabel = '미설정'
  readonly auth = defaultAuthState
  readonly currentYear = new Date().getFullYear()
  readonly currentMonth = new Date().getMonth() + 1
  readonly hasWriteAccess = false

  async login(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async relogin(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async logout(): Promise<void> {
    throw new Error('로그아웃 기능이 아직 연결되지 않았습니다.')
  }

  async bootstrap(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  setCurrentYearMonth(): void {}

  async getReferenceData(): Promise<TransactionReferenceData> {
    return {
      accounts: [],
      categories: [],
    }
  }

  async listTransactions(_filters: HistoryFilters): Promise<Transaction[]> {
    return []
  }

  async getAccountBalances(): Promise<AccountBalance[]> {
    return []
  }

  async saveTransaction(
    _draft: TransactionDraft,
  ): Promise<SavedTransactionResult> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async updateTransaction(
    _transaction: Transaction,
    _draft: TransactionDraft,
  ): Promise<SavedTransactionResult> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async deleteTransaction(_transaction: Transaction): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async getBudgets(): Promise<MonthlyBudget[]> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async getBudgetMaximum(): Promise<number | undefined> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async saveBudgetPlan(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async saveBudgetSettlement(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async getSettingsData(): Promise<SettingsData> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async createBudgetGroup(): Promise<BudgetGroup> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async createAccount(): Promise<Account> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async renameAccount(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async disableAccount(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async createCategory(): Promise<Category> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async renameCategory(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async disableCategory(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async getYearGraph(): Promise<YearGraph> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async linkYear(): Promise<LinkedYear[]> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async syncMonthZero(): Promise<void> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async getSettlement(): Promise<SettlementSummary> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async getInvestment(): Promise<InvestmentSummary> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  async getEnergy(): Promise<EnergySummary> {
    throw new Error(UNCONFIGURED_MESSAGE)
  }

  openGoogleSheet(): void {
    window.open(
      'https://docs.google.com/spreadsheets/',
      '_blank',
      'noopener,noreferrer',
    )
  }
}

export const defaultAppService: AppService = new UnconfiguredAppService()
export const AppServiceContext = createContext<AppService>(defaultAppService)
