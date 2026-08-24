import type { AccountMutation } from '@/domain/account.ts'
import type { CategoryMutation } from '@/domain/category.ts'
import { AppError, toAppError } from '@/domain/errors.ts'
import type {
  SavedTransactionResult,
  Transaction,
  TransactionDraft,
  TransactionLookup,
} from '@/domain/transaction.ts'
import type {
  LinkedYear,
  YearConfig,
  YearGraph,
  YearLinkRequest,
} from '@/domain/year.ts'
import {
  type AppAuthState,
  type AppServiceState,
  type HistoryFilters,
  type SettingsData,
  type TransactionReferenceData,
} from '@/app/app-service-core.ts'
import { loadGoogleIdentityScript } from '@/app/google-identity-script.ts'
import { GoogleSheetsLedgerRepository } from '@/repositories/googleSheetsLedgerRepository.ts'
import type { LedgerRepository } from '@/repositories/ledgerRepository.ts'
import { readAppEnv, type AppEnv } from '@/services/env.ts'
import { GoogleIdentityService } from '@/services/googleAuth/googleIdentityService.ts'
import { InMemoryTokenStore } from '@/services/googleAuth/tokenStore.ts'
import { getYearMonthFromDate, toKstDateParts } from '@/utils/date.ts'

type Listener = () => void

interface AppServiceControllerOptions {
  envSource?: ImportMetaEnv
  windowRef?: Window
  documentRef?: Document
  tokenStorage?: Storage
}

interface AuthorizedServices {
  env: AppEnv
  tokenStore: InMemoryTokenStore
  identityService: GoogleIdentityService
  repository: LedgerRepository
}

interface InternalState extends AppServiceState {
  bootstrapYear?: number
}

interface GoogleIdentityWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient?: unknown
        revoke?: (token: string, done?: () => void) => void
      }
    }
  }
}

function createSignedOutState(
  currentYear: number,
  currentMonth: number,
  hasWriteAccess: boolean,
): InternalState {
  return {
    isConfigured: true,
    statusLabel: '로그인 필요',
    auth: {
      status: 'signed_out',
      message: 'Google 로그인 후 가계부를 불러올 수 있습니다.',
      isBusy: false,
      isAuthenticated: false,
      canRead: false,
      canWrite: false,
      requiresLogin: true,
    },
    currentYear,
    currentMonth,
    hasWriteAccess,
  }
}

function createUnconfiguredState(
  currentYear: number,
  currentMonth: number,
  message: string,
): InternalState {
  return {
    isConfigured: false,
    statusLabel: '미설정',
    auth: {
      status: 'unconfigured',
      message,
      isBusy: false,
      isAuthenticated: false,
      canRead: false,
      canWrite: false,
      requiresLogin: false,
      errorCode: 'CONFIG_MISSING',
    },
    currentYear,
    currentMonth,
    hasWriteAccess: false,
  }
}

function createReadyState(
  currentYear: number,
  currentMonth: number,
  canWrite: boolean,
  bootstrapYear: number,
): InternalState {
  return {
    isConfigured: true,
    statusLabel: canWrite ? 'Google Sheet 연결됨' : '읽기 전용 연결',
    auth: {
      status: 'ready',
      message: canWrite
        ? 'Google Sheet가 연결되었습니다.'
        : '읽기는 가능하지만 쓰기는 차단되어 있습니다.',
      isBusy: false,
      isAuthenticated: true,
      canRead: true,
      canWrite,
      requiresLogin: false,
    },
    currentYear,
    currentMonth,
    hasWriteAccess: canWrite,
    bootstrapYear,
  }
}

function createTransientAuthState(
  current: InternalState,
  status: AppAuthState['status'],
  message: string,
): InternalState {
  return {
    ...current,
    statusLabel: status === 'authenticating' ? '로그인 중' : '연결 확인 중',
    auth: {
      status,
      message,
      isBusy: true,
      isAuthenticated: false,
      canRead: false,
      canWrite: false,
      requiresLogin: false,
    },
  }
}

function getCurrentKstYearMonth() {
  const { year, month } = toKstDateParts()
  return { year, month }
}

function extractHttpStatus(error: AppError): number | undefined {
  const status = error.details?.status
  return typeof status === 'number' ? status : undefined
}

function normalizeError(error: unknown): AppError {
  const baseError = toAppError(error, {
    code: 'NETWORK_ERROR',
    userMessage: '네트워크 상태를 확인하고 다시 시도해주세요.',
  })

  if (
    baseError.code === 'GOOGLE_API_ERROR' &&
    [403, 404].includes(extractHttpStatus(baseError) ?? 0)
  ) {
    return new AppError('ACCESS_DENIED', 'Google Sheet 접근 권한이 없습니다.', {
      cause: baseError,
      details: baseError.details,
    })
  }

  if (
    baseError.code === 'AUTH_REQUIRED' &&
    baseError.details?.error === 'access_denied'
  ) {
    return new AppError('ACCESS_DENIED', 'Google 로그인 권한이 필요합니다.', {
      cause: baseError,
      details: baseError.details,
    })
  }

  return baseError
}

function buildErrorState(current: InternalState, error: AppError): InternalState {
  switch (error.code) {
    case 'ACCESS_DENIED':
      return {
        ...current,
        statusLabel: '권한 필요',
        auth: {
          status: 'access_denied',
          message: error.userMessage,
          isBusy: false,
          isAuthenticated: false,
          canRead: false,
          canWrite: false,
          requiresLogin: true,
          errorCode: error.code,
        },
        hasWriteAccess: false,
      }
    case 'AUTH_EXPIRED':
    case 'AUTH_REQUIRED':
      return {
        ...current,
        statusLabel: '다시 로그인 필요',
        auth: {
          status: 'auth_expired',
          message: error.userMessage,
          isBusy: false,
          isAuthenticated: false,
          canRead: false,
          canWrite: false,
          requiresLogin: true,
          errorCode: error.code,
        },
        hasWriteAccess: false,
      }
    case 'NETWORK_ERROR':
      return {
        ...current,
        statusLabel: '네트워크 오류',
        auth: {
          status: 'network_error',
          message: error.userMessage,
          isBusy: false,
          isAuthenticated: false,
          canRead: false,
          canWrite: false,
          requiresLogin: false,
          errorCode: error.code,
        },
        hasWriteAccess: false,
      }
    case 'CONFIG_MISSING':
      return createUnconfiguredState(
        current.currentYear,
        current.currentMonth,
        error.userMessage,
      )
    default:
      return {
        ...current,
        statusLabel: '연결 오류',
        auth: {
          status: 'unavailable',
          message: error.userMessage,
          isBusy: false,
          isAuthenticated: false,
          canRead: false,
          canWrite: false,
          requiresLogin: true,
          errorCode: error.code,
        },
        hasWriteAccess: false,
      }
  }
}

function buildTransactionLookup(transaction: Transaction): TransactionLookup {
  return {
    year: transaction.sourceYear,
    month: transaction.sourceMonth,
    transactionId: transaction.id,
    transferId: transaction.transferId,
    sourceRow: transaction.sourceRow,
    legacyFingerprint: {
      date: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
      account: transaction.account,
      category: transaction.category,
    },
  }
}

function parseHistoryMonth(monthValue: string): { year: number; month: number } {
  const match = monthValue.match(/^(\d{4})-(\d{2})$/)
  if (!match) {
    throw new AppError('VALIDATION_ERROR', '조회 월 형식을 확인해주세요.')
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  }
}

function toLinkedYears(graph: YearGraph): LinkedYear[] {
  return [...graph.years.values()]
    .map((config) => ({
      year: config.year,
      spreadsheetId: config.spreadsheetId,
      connected: true,
    }))
    .sort((left, right) => left.year - right.year)
}

export class AppServiceController {
  readonly #windowRef: GoogleIdentityWindow
  readonly #documentRef?: Document
  readonly #services?: AuthorizedServices
  readonly #listeners = new Set<Listener>()

  #state: InternalState
  #yearGraph?: YearGraph
  #yearConfigByYear = new Map<number, YearConfig>()
  #resumePromise?: Promise<void>

  constructor(options: AppServiceControllerOptions = {}) {
    const { year, month } = getCurrentKstYearMonth()
    this.#windowRef = (options.windowRef ?? window) as GoogleIdentityWindow
    this.#documentRef = options.documentRef

    try {
      const env = readAppEnv(options.envSource ?? import.meta.env)
      const tokenStore = new InMemoryTokenStore({
        storage: options.tokenStorage,
        storageKey: `account-book.google-access-token:${env.googleClientId}:${env.bootstrapSpreadsheetId}`,
      })
      const identityService = new GoogleIdentityService({
        env,
        tokenStore,
        windowRef: this.#windowRef as never,
      })
      const repository = new GoogleSheetsLedgerRepository({
        env,
        tokenStore,
      })

      this.#services = {
        env,
        tokenStore,
        identityService,
        repository,
      }
      this.#state = createSignedOutState(
        year,
        month,
        true,
      )
    } catch (error) {
      const appError = normalizeError(error)
      this.#state = createUnconfiguredState(year, month, appError.userMessage)
    }
  }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  getSnapshot(): AppServiceState {
    return this.#state
  }

  setCurrentYearMonth(year: number, month: number): void {
    if (
      this.#state.currentYear === year &&
      this.#state.currentMonth === month
    ) {
      return
    }
    this.#setState({
      ...this.#state,
      currentYear: year,
      currentMonth: month,
    })
  }

  async login(): Promise<void> {
    await this.#authenticateAndBootstrap('')
  }

  async relogin(): Promise<void> {
    await this.#authenticateAndBootstrap('select_account')
  }

  async logout(): Promise<void> {
    const services = this.#requireServices()
    const currentToken = services.tokenStore.get()?.accessToken
    if (currentToken) {
      await new Promise<void>((resolve) => {
        this.#windowRef.google?.accounts?.oauth2?.revoke?.(currentToken, () => {
          resolve()
        })
        if (!this.#windowRef.google?.accounts?.oauth2?.revoke) {
          resolve()
        }
      })
    }

    services.tokenStore.clear()
    this.#clearAuthorizedData()
    this.#setState(
      createSignedOutState(
        this.#state.currentYear,
        this.#state.currentMonth,
        true,
      ),
    )
  }

  async bootstrap(): Promise<void> {
    await this.#runBootstrap()
  }

  async resumeSession(): Promise<void> {
    if (this.#resumePromise) {
      return this.#resumePromise
    }

    const run = async () => {
      // An unconfigured app already exposes a complete setup state. Session
      // restoration is a no-op there rather than an unhandled rejected promise.
      const services = this.#services
      if (!services) {
        return
      }
      const snapshot = services.tokenStore.get()
      if (!snapshot) {
        return
      }

      // Do not start a multi-request bootstrap with a token that is about to
      // expire. The user can obtain a fresh token with one explicit click.
      if (snapshot.expiresAt <= Date.now() + 60_000) {
        services.tokenStore.clear()
        this.#setState(
          createSignedOutState(
            this.#state.currentYear,
            this.#state.currentMonth,
            true,
          ),
        )
        return
      }

      try {
        await this.#runBootstrap()
      } catch {
        // #runBootstrap already converts the failure into a visible auth state.
      }
    }

    const promise = run()
    this.#resumePromise = promise
    try {
      await promise
    } finally {
      this.#resumePromise = undefined
    }
  }

  async getReferenceData(year = this.#state.currentYear): Promise<TransactionReferenceData> {
    return this.#withRepository(async (repository) => {
      const [accounts, categories] = await Promise.all([
        repository.getAccounts(year),
        repository.getCategories(year),
      ])

      return {
        accounts: accounts
          .filter((account) => account.active)
          .sort((left, right) => left.order - right.order)
          .map((account) => account.name),
        categories: categories
          .filter((category) => category.active)
          .sort((left, right) => left.order - right.order)
          .map((category) => category.name),
      }
    })
  }

  async listTransactions(filters: HistoryFilters): Promise<Transaction[]> {
    return this.#withRepository(async (repository) => {
      const { year, month } = parseHistoryMonth(filters.month)
      this.setCurrentYearMonth(year, month)
      return repository.getMonthTransactions(year, month)
    })
  }

  async saveTransaction(draft: TransactionDraft): Promise<SavedTransactionResult> {
    const { year, month } = getYearMonthFromDate(draft.date)
    this.setCurrentYearMonth(year, month)
    return this.#withRepository((repository) => repository.appendTransaction(draft))
  }

  async updateTransaction(
    transaction: Transaction,
    draft: TransactionDraft,
  ): Promise<SavedTransactionResult> {
    const { year, month } = getYearMonthFromDate(draft.date)
    this.setCurrentYearMonth(year, month)
    return this.#withRepository((repository) =>
      repository.updateTransaction(buildTransactionLookup(transaction), draft),
    )
  }

  async deleteTransaction(transaction: Transaction): Promise<void> {
    await this.#withRepository((repository) =>
      repository.deleteTransaction(buildTransactionLookup(transaction)),
    )
  }

  async getBudgets(year: number, month: number) {
    return this.#withRepository((repository) => repository.getMonthlyBudgets(year, month))
  }

  async getBudgetMaximum(year: number, month: number) {
    return this.#withRepository((repository) => repository.getMonthlyBudgetMaximum(year, month))
  }

  async saveBudgetPlan(
    year: number,
    month: number,
    input: Parameters<LedgerRepository['saveBudgetPlan']>[2],
  ): Promise<void> {
    await this.#withRepository((repository) =>
      repository.saveBudgetPlan(year, month, input),
    )
  }

  async saveBudgetSettlement(
    year: number,
    month: number,
    input: Parameters<LedgerRepository['saveBudgetSettlement']>[2],
  ): Promise<void> {
    await this.#withRepository((repository) =>
      repository.saveBudgetSettlement(year, month, input),
    )
  }

  async getSettingsData(year: number): Promise<SettingsData> {
    return this.#withRepository(async (repository) => {
      const graph = await this.#getOrLoadYearGraph(repository)
      const yearConfig = graph.years.get(year)
      if (!yearConfig) {
        throw new AppError('NOT_FOUND', '연결된 연도 Sheet를 찾지 못했습니다.')
      }

      const [accounts, categories, budgetGroups] = await Promise.all([
        repository.getAccounts(year),
        repository.getCategories(year),
        repository.getBudgetGroups(year),
      ])

      return {
        year,
        yearConfig,
        linkedYears: toLinkedYears(graph),
        accounts,
        categories,
        budgetGroups,
      }
    })
  }

  async createBudgetGroup(year: number, input: Parameters<LedgerRepository['createBudgetGroup']>[1]) {
    return this.#withRepository((repository) => repository.createBudgetGroup(year, input))
  }

  async createAccount(year: number, input: AccountMutation) {
    return this.#withRepository((repository) => repository.createAccount(year, input))
  }

  async renameAccount(
    year: number,
    previousName: string,
    nextName: string,
  ): Promise<void> {
    await this.#withRepository((repository) =>
      repository.renameAccount(year, previousName, nextName),
    )
  }

  async disableAccount(year: number, name: string): Promise<void> {
    await this.#withRepository((repository) => repository.disableAccount(year, name))
  }

  async createCategory(year: number, input: CategoryMutation) {
    return this.#withRepository((repository) => repository.createCategory(year, input))
  }

  async renameCategory(
    year: number,
    previousName: string,
    nextName: string,
  ): Promise<void> {
    await this.#withRepository((repository) =>
      repository.renameCategory(year, previousName, nextName),
    )
  }

  async disableCategory(year: number, name: string): Promise<void> {
    await this.#withRepository((repository) => repository.disableCategory(year, name))
  }

  async getYearGraph(): Promise<YearGraph> {
    return this.#withRepository((repository) => this.#getOrLoadYearGraph(repository))
  }

  async linkYear(request: YearLinkRequest): Promise<LinkedYear[]> {
    return this.#withRepository(async (repository) => {
      const linkedYears = await repository.linkYear(request)
      this.#yearGraph = undefined
      this.#yearConfigByYear.clear()
      const refreshedGraph = await this.#getOrLoadYearGraph(repository)
      this.#ensureCurrentYear(refreshedGraph)
      return linkedYears
    })
  }

  async syncMonthZero(year: number): Promise<void> {
    await this.#withRepository((repository) => repository.syncMonthZero(year))
  }

  async getSettlement(year: number, month: number) {
    return this.#withRepository((repository) => repository.getSettlement(year, month))
  }

  async getInvestment(year: number, month: number) {
    return this.#withRepository((repository) =>
      repository.getInvestmentSummary(year, month),
    )
  }

  async getEnergy(year: number, month: number) {
    return this.#withRepository((repository) => repository.getEnergySummary(year, month))
  }

  openGoogleSheet(year = this.#state.currentYear): void {
    const spreadsheetUrl =
      this.#yearGraph?.years.get(year)?.spreadsheetUrl ??
      this.#services?.env.bootstrapSpreadsheetId

    if (!spreadsheetUrl) {
      window.open(
        'https://docs.google.com/spreadsheets/',
        '_blank',
        'noopener,noreferrer',
      )
      return
    }

    const href = spreadsheetUrl.startsWith('http')
      ? spreadsheetUrl
      : `https://docs.google.com/spreadsheets/d/${spreadsheetUrl}/edit`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  async #authenticateAndBootstrap(
    prompt: '' | 'consent' | 'select_account',
  ): Promise<void> {
    const services = this.#requireServices()
    this.#setState(
      createTransientAuthState(
        this.#state,
        'authenticating',
        'Google 로그인을 진행하는 중입니다.',
      ),
    )

    try {
      await loadGoogleIdentityScript({ documentRef: this.#documentRef })
      await services.identityService.requestAccessToken(undefined, prompt)
      await this.#runBootstrap()
    } catch (error) {
      this.#handleError(error)
    }
  }

  async #runBootstrap(): Promise<void> {
    const services = this.#requireServices()
    this.#setState(
      createTransientAuthState(
        this.#state,
        'bootstrapping',
        'Google Sheet 구조와 접근 권한을 확인하는 중입니다.',
      ),
    )

    try {
      const { yearConfig, yearGraph } = await services.repository.bootstrap()
      this.#yearGraph = yearGraph
      this.#yearConfigByYear = new Map(
        [...yearGraph.years.values()].map((config) => [config.year, config]),
      )
      this.#setReadyState(yearConfig)
    } catch (error) {
      this.#handleError(error)
    }
  }

  #setReadyState(yearConfig: YearConfig): void {
    const now = getCurrentKstYearMonth()
    const availableYears = this.#yearGraph?.years ?? new Map<number, YearConfig>()
    const currentYear = availableYears.has(now.year) ? now.year : yearConfig.year
    const currentMonth = currentYear === now.year ? now.month : 1
    this.#setState(createReadyState(currentYear, currentMonth, true, yearConfig.year))
  }

  #ensureCurrentYear(graph: YearGraph): void {
    if (graph.years.has(this.#state.currentYear)) {
      return
    }

    const firstYear = [...graph.years.keys()].sort((left, right) => left - right)[0]
    if (firstYear) {
      this.setCurrentYearMonth(firstYear, this.#state.currentMonth)
    }
  }

  async #getOrLoadYearGraph(repository: LedgerRepository): Promise<YearGraph> {
    if (this.#yearGraph) {
      return this.#yearGraph
    }

    const graph = await repository.getYearGraph()
    this.#yearGraph = graph
    this.#yearConfigByYear = new Map(
      [...graph.years.values()].map((config) => [config.year, config]),
    )
    return graph
  }

  async #withRepository<T>(
    task: (repository: LedgerRepository) => Promise<T>,
  ): Promise<T> {
    const repository = this.#requireReadyRepository()

    try {
      return await task(repository)
    } catch (error) {
      const normalized = normalizeError(error)
      if (
        normalized.code === 'AUTH_REQUIRED' ||
        normalized.code === 'AUTH_EXPIRED' ||
        normalized.code === 'ACCESS_DENIED'
      ) {
        return this.#handleError(normalized)
      }

      // Keep operational failures on the current page so an input draft and
      // its idempotency key remain available for an explicit retry.
      throw normalized
    }
  }

  #requireServices(): AuthorizedServices {
    if (!this.#services) {
      throw new AppError(
        'CONFIG_MISSING',
        '앱 설정이 올바르지 않습니다. 환경설정을 확인해주세요.',
      )
    }

    return this.#services
  }

  #requireReadyRepository(): LedgerRepository {
    if (this.#state.auth.status !== 'ready') {
      if (!this.#services) {
        throw new AppError(
          'CONFIG_MISSING',
          '앱 설정이 올바르지 않습니다. 환경설정을 확인해주세요.',
        )
      }

      if (
        this.#state.auth.status === 'auth_expired' ||
        this.#state.auth.status === 'signed_out' ||
        this.#state.auth.requiresLogin
      ) {
        throw new AppError('AUTH_REQUIRED', 'Google 로그인이 필요합니다.')
      }

      throw new AppError('UNAVAILABLE', this.#state.auth.message)
    }

    return this.#requireServices().repository
  }

  #handleError(error: unknown): never {
    const normalized = normalizeError(error)
    const services = this.#services

    if (normalized.code === 'AUTH_REQUIRED' || normalized.code === 'AUTH_EXPIRED') {
      services?.tokenStore.clear()
    }
    this.#clearAuthorizedData()
    this.#setState(buildErrorState(this.#state, normalized))

    throw normalized
  }

  #clearAuthorizedData(): void {
    this.#yearGraph = undefined
    this.#yearConfigByYear.clear()
  }

  #setState(nextState: InternalState): void {
    this.#state = nextState
    for (const listener of this.#listeners) {
      listener()
    }
  }
}
