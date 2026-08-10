import type { Account, AccountMutation } from '@/domain/account.ts'
import {
  buildBudgetTimeline,
  resetCarryOverAdjustment,
  type BudgetGroup,
  type MonthlyBudget,
  type MonthlyBudgetSource,
} from '@/domain/budget.ts'
import type { Category, CategoryMutation } from '@/domain/category.ts'
import { AppError } from '@/domain/errors.ts'
import type { EnergySummary } from '@/domain/energy.ts'
import type { InvestmentSummary } from '@/domain/investment.ts'
import type { SettlementSummary } from '@/domain/settlement.ts'
import type {
  LegacyTransactionFingerprint,
  SavedTransactionResult,
  Transaction,
  TransactionDraft,
  TransactionLookup,
} from '@/domain/transaction.ts'
import type { LinkedYear, YearConfig, YearGraph, YearLinkRequest } from '@/domain/year.ts'
import {
  InMemoryTokenStore,
} from '@/services/googleAuth/tokenStore.ts'
import { parseAccounts, parseBudgetGroups, parseCategories, parseMonthlyBudgetSources } from '@/services/sheets/masterAdapters.ts'
import { parseEnergySummary, parseInvestmentSummary } from '@/services/sheets/readOnlyAdapters.ts'
import { parseYearConfig, validateSpreadsheetStructure } from '@/services/sheets/schema.ts'
import {
  type AppendValuesResponse,
  type SheetsSpreadsheet,
  type SheetsValueRange,
  SheetsClient,
} from '@/services/sheets/sheetsClient.ts'
import {
  buildAppendRows,
  collapseTransferPairs,
  matchesLegacyFingerprint,
  parseTransactionRow,
  parseTransactions,
} from '@/services/sheets/transactionAdapter.ts'
import type { AppEnv } from '@/services/env.ts'
import { assertMonth, getYearMonthFromDate } from '@/utils/date.ts'
import {
  parseSheetNumber,
  toUserEnteredLiteral,
  trimCell,
} from '@/utils/format.ts'
import { buildRange, buildRowRange } from '@/utils/sheets.ts'
import type { BootstrapResult, LedgerRepository } from './ledgerRepository.ts'

interface GoogleSheetsLedgerRepositoryOptions {
  env: AppEnv
  tokenStore: InMemoryTokenStore
  sheetsClient?: SheetsClient
}

interface ResolvedYearTarget {
  config: YearConfig
  spreadsheet: SheetsSpreadsheet
}

interface LocatedTransaction {
  transaction: Transaction
  sibling?: Transaction
  spreadsheetId: string
}

const MONTH_SHEET_COLUMNS = 'A:Z'

export class GoogleSheetsLedgerRepository implements LedgerRepository {
  readonly #env: AppEnv
  readonly #tokenStore: InMemoryTokenStore
  readonly #sheetsClient: SheetsClient
  readonly #connectedYearConfigCache = new Map<number, YearConfig>()
  readonly #writeAllowedSpreadsheetIds = new Set<string>()

  constructor(options: GoogleSheetsLedgerRepositoryOptions) {
    this.#env = options.env
    this.#tokenStore = options.tokenStore
    this.#sheetsClient =
      options.sheetsClient ??
      new SheetsClient({
        getAccessToken: () => this.#tokenStore.requireValidToken().accessToken,
      })
  }

  async bootstrap(): Promise<BootstrapResult> {
    const yearConfig = await this.verifyAccess(this.#env.bootstrapSpreadsheetId)
    const yearGraph = await this.#buildYearGraph(yearConfig)
    return { yearConfig, yearGraph }
  }

  async verifyAccess(spreadsheetId: string): Promise<YearConfig> {
    const [spreadsheet, appSettings] = await Promise.all([
      this.#sheetsClient.getSpreadsheet(spreadsheetId),
      this.#sheetsClient.getValues(spreadsheetId, buildRange('앱설정', 'A:B')),
    ])

    validateSpreadsheetStructure(spreadsheet)
    const config = parseYearConfig(spreadsheetId, spreadsheet.properties?.title, appSettings)
    return config
  }

  async getYearGraph(): Promise<YearGraph> {
    const bootstrapConfig = await this.verifyAccess(this.#env.bootstrapSpreadsheetId)
    return this.#buildYearGraph(bootstrapConfig)
  }

  async #buildYearGraph(bootstrapConfig: YearConfig): Promise<YearGraph> {
    const years = new Map<number, YearConfig>([[bootstrapConfig.year, bootstrapConfig]])
    const visitedSpreadsheetIds = new Set<string>([bootstrapConfig.spreadsheetId])
    this.#writeAllowedSpreadsheetIds.clear()
    if (this.#isTestYearConfig(bootstrapConfig)) {
      this.#writeAllowedSpreadsheetIds.add(bootstrapConfig.spreadsheetId)
    }

    let previousNeighbor = bootstrapConfig
    let previousId = previousNeighbor.previousSpreadsheetId
    while (previousId) {
      if (visitedSpreadsheetIds.has(previousId)) {
        throw new AppError('INVALID_CONFIG', '연도별 Sheet 연결이 순환하고 있습니다.')
      }
      visitedSpreadsheetIds.add(previousId)
      const config = await this.verifyAccess(previousId)
      if (
        config.year !== previousNeighbor.year - 1 ||
        config.nextSpreadsheetId !== previousNeighbor.spreadsheetId
      ) {
        throw new AppError(
          'INVALID_CONFIG',
          '이전 연도 Sheet 연결 정보를 확인해주세요.',
        )
      }
      years.set(config.year, config)
      if (this.#isTestYearConfig(config)) {
        this.#writeAllowedSpreadsheetIds.add(config.spreadsheetId)
      }
      previousNeighbor = config
      previousId = config.previousSpreadsheetId
    }

    let nextNeighbor = bootstrapConfig
    let nextId = nextNeighbor.nextSpreadsheetId
    while (nextId) {
      if (visitedSpreadsheetIds.has(nextId)) {
        throw new AppError('INVALID_CONFIG', '연도별 Sheet 연결이 순환하고 있습니다.')
      }
      visitedSpreadsheetIds.add(nextId)
      const config = await this.verifyAccess(nextId)
      if (
        config.year !== nextNeighbor.year + 1 ||
        config.previousSpreadsheetId !== nextNeighbor.spreadsheetId
      ) {
        throw new AppError(
          'INVALID_CONFIG',
          '다음 연도 Sheet 연결 정보를 확인해주세요.',
        )
      }
      years.set(config.year, config)
      if (this.#isTestYearConfig(config)) {
        this.#writeAllowedSpreadsheetIds.add(config.spreadsheetId)
      }
      nextNeighbor = config
      nextId = config.nextSpreadsheetId
    }

    this.#connectedYearConfigCache.clear()
    for (const [year, config] of years) {
      this.#connectedYearConfigCache.set(year, config)
    }

    return {
      bootstrapSpreadsheetId: this.#env.bootstrapSpreadsheetId,
      years,
    }
  }

  async getMonthTransactions(year: number, month: number): Promise<Transaction[]> {
    return collapseTransferPairs(await this.#getRawMonthTransactions(year, month))
  }

  async #getRawMonthTransactions(year: number, month: number): Promise<Transaction[]> {
    const config = await this.#resolveYearConfig(year)
    const values = await this.#sheetsClient.getValues(
      config.spreadsheetId,
      buildRange(String(month), MONTH_SHEET_COLUMNS),
    )

    return parseTransactions(year, month, values.values ?? [])
      .filter((transaction) => transaction.sourceRow !== 1)
      .sort((left, right) => {
        if (left.date !== right.date) {
          return right.date.localeCompare(left.date)
        }
        return (right.sourceRow ?? 0) - (left.sourceRow ?? 0)
      })
  }

  async appendTransaction(draft: TransactionDraft): Promise<SavedTransactionResult> {
    this.#validateDraft(draft)
    const { year, month } = getYearMonthFromDate(draft.date)
    if (month === 0) {
      throw new AppError('VALIDATION_ERROR', '0월에는 거래를 입력할 수 없습니다.')
    }

    const config = await this.#resolveYearConfig(year)
    this.#assertWriteAllowed(config.spreadsheetId)

    const appendRows = buildAppendRows(draft)
    const existingTransactions = await this.#getRawMonthTransactions(year, month)
    if (appendRows.transferId) {
      const existingTransferRows = existingTransactions.filter(
        (transaction) => transaction.transferId === appendRows.transferId,
      )
      if (existingTransferRows.length === 2) {
        return this.#buildSavedTransfer(existingTransferRows[0], existingTransferRows[1])
      }
      if (existingTransferRows.length > 0) {
        throw new AppError(
          'TRANSFER_INTEGRITY',
          '같은 요청의 이체 행이 일부만 확인됩니다. 다시 저장하지 말고 Sheet를 확인해주세요.',
        )
      }
    } else if (appendRows.transactionId) {
      const existingTransaction = existingTransactions.find(
        (transaction) => transaction.id === appendRows.transactionId,
      )
      if (existingTransaction) {
        return { transaction: existingTransaction }
      }
    }

    const response = await this.#sheetsClient.appendValues(
      config.spreadsheetId,
      buildRange(String(month), 'A:Z'),
      appendRows.rows,
    )

    const rowNumbers = this.#extractAppendedRowNumbers(response, appendRows.rows.length)
    try {
      await this.#ensureAppendedMetadata(
        config.spreadsheetId,
        month,
        rowNumbers,
        appendRows,
      )
    } catch (error) {
      const message = draft.type === 'transfer'
        ? '이체 금융 행이 저장되었을 수 있습니다. 다시 저장하지 말고 Sheet를 확인해주세요.'
        : '거래 행이 저장되었을 수 있습니다. 다시 저장하지 말고 Sheet를 확인해주세요.'
      throw new AppError(
        draft.type === 'transfer' ? 'TRANSFER_INTEGRITY' : 'GOOGLE_API_ERROR',
        message,
        { cause: error },
      )
    }

    const appendedTransactions = appendRows.rows.map((values, index) =>
      parseTransactionRow(year, month, {
        rowNumber: rowNumbers[index],
        values,
      }),
    )

    if (appendRows.transferId) {
      const matched = appendedTransactions.filter(
        (transaction): transaction is Transaction => Boolean(transaction),
      )
      if (matched.length !== 2) {
        throw new AppError('TRANSFER_INTEGRITY', '이체 저장 결과를 확인하지 못했습니다.')
      }

      return this.#buildSavedTransfer(matched[0], matched[1])
    }

    const transaction = appendedTransactions[0]
    if (!transaction) {
      throw new AppError('GOOGLE_API_ERROR', '저장 결과를 해석하지 못했습니다.')
    }

    return { transaction }
  }

  async updateTransaction(
    lookup: TransactionLookup,
    draft: TransactionDraft,
  ): Promise<SavedTransactionResult> {
    this.#validateDraft(draft)
    const located = await this.#locateTransaction(lookup)
    const destination = getYearMonthFromDate(draft.date)
    const staysInSourceMonth =
      destination.year === located.transaction.sourceYear &&
      destination.month === located.transaction.sourceMonth

    if (located.transaction.transferId && draft.type === 'transfer' && staysInSourceMonth) {
      const outgoing = located.transaction.amount < 0
        ? located.transaction
        : located.sibling
      const incoming = located.transaction.amount > 0
        ? located.transaction
        : located.sibling
      if (!outgoing?.sourceRow || !incoming?.sourceRow) {
        throw new AppError('TRANSFER_INTEGRITY', '연결된 이체 거래를 찾지 못했습니다.')
      }
      this.#assertWriteAllowed(located.spreadsheetId)
      const rows = buildAppendRows(draft).rows
      for (const row of rows) {
        row[24] = ''
        row[25] = located.transaction.transferId
      }
      await this.#sheetsClient.batchUpdateValues(located.spreadsheetId, [
        {
          range: buildRowRange(String(outgoing.sourceMonth), outgoing.sourceRow),
          values: [this.#mergeUpdatedLedgerRow(outgoing.rawValues, rows[0])],
        },
        {
          range: buildRowRange(String(incoming.sourceMonth), incoming.sourceRow),
          values: [this.#mergeUpdatedLedgerRow(incoming.rawValues, rows[1])],
        },
      ])
      const refreshed = await this.#locateTransaction({
        year: outgoing.sourceYear,
        month: outgoing.sourceMonth,
        transferId: located.transaction.transferId,
        sourceRow: outgoing.sourceRow,
      })
      return this.#buildSavedTransfer(refreshed.transaction, refreshed.sibling)
    }

    if (!located.transaction.transferId && draft.type !== 'transfer' && staysInSourceMonth) {
      const row = buildAppendRows(draft).rows[0]
      row[24] = located.transaction.id ?? ''
      row[25] = ''
      const mergedRow = this.#mergeUpdatedLedgerRow(located.transaction.rawValues, row)
      await this.#updateRowValues(
        located.spreadsheetId,
        located.transaction.sourceMonth,
        located.transaction.sourceRow!,
        mergedRow,
      )

      const refreshed = await this.#locateTransaction({
        year: located.transaction.sourceYear,
        month: located.transaction.sourceMonth,
        transactionId: located.transaction.id,
        sourceRow: located.transaction.sourceRow,
      })
      return { transaction: refreshed.transaction }
    }

    // Cross-month/year moves and type changes cannot be atomic across
    // spreadsheets. Append first so a failed cleanup cannot lose money data.
    const appended = await this.appendTransaction({
      ...draft,
      clientRequestId:
        draft.clientRequestId ?? this.#buildMoveRequestId(located.transaction, draft.type),
    })
    try {
      await this.deleteTransaction({
        year: located.transaction.sourceYear,
        month: located.transaction.sourceMonth,
        transactionId: located.transaction.id,
        transferId: located.transaction.transferId,
        sourceRow: located.transaction.sourceRow,
      })
    } catch (error) {
      throw new AppError(
        'CONFLICT',
        '새 위치에는 저장했지만 기존 거래를 삭제하지 못했습니다. 내역을 새로고침해주세요.',
        {
          cause: error,
          details: {
            appendedTransactionId: appended.transaction.id,
            appendedTransferId: appended.transaction.transferId,
          },
        },
      )
    }
    return appended
  }

  async deleteTransaction(lookup: TransactionLookup): Promise<void> {
    const located = await this.#locateTransaction(lookup)
    this.#assertWriteAllowed(located.spreadsheetId)

    const rows = [located.transaction.sourceRow]
    if (located.sibling?.sourceRow) {
      rows.push(located.sibling.sourceRow)
    }

    const { spreadsheet } = await this.#resolveYearTarget(located.transaction.sourceYear)
    const monthSheetId = this.#findSheetId(spreadsheet, String(located.transaction.sourceMonth))
    await this.#sheetsClient.batchUpdate(
      located.spreadsheetId,
      rows
        .filter((row): row is number => Boolean(row))
        .sort((left, right) => right - left)
        .map((rowNumber) => ({
          deleteDimension: {
            range: {
              sheetId: monthSheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        })),
    )
  }

  async getAccounts(year: number): Promise<Account[]> {
    const config = await this.#resolveYearConfig(year)
    const range = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange('통장', 'A:D'))
    return parseAccounts(range)
  }

  async createAccount(year: number, input: AccountMutation): Promise<Account> {
    const config = await this.#resolveYearConfig(year)
    this.#assertWriteAllowed(config.spreadsheetId)
    const accounts = await this.getAccounts(year)
    const name = input.name.trim()
    if (!name) {
      throw new AppError('VALIDATION_ERROR', '통장 이름을 입력해주세요.')
    }
    if (accounts.some((account) => account.name === name)) {
      throw new AppError('VALIDATION_ERROR', '같은 이름의 통장이 이미 있습니다.')
    }
    const nextOrder = (accounts.at(-1)?.order ?? 0) + 1
    await this.#sheetsClient.appendValues(config.spreadsheetId, buildRange('통장', 'A:D'), [[
      toUserEnteredLiteral(name),
      'TRUE',
      toUserEnteredLiteral(input.assetGroup?.trim() ?? ''),
      String(nextOrder),
    ]])
    return {
      name,
      active: true,
      assetGroup: input.assetGroup?.trim() || undefined,
      order: nextOrder,
    }
  }

  async renameAccount(year: number, previousName: string, nextName: string): Promise<void> {
    await this.#renameMasterAndMonthlyColumn(year, '통장', 0, previousName, nextName, 3)
  }

  async disableAccount(year: number, name: string): Promise<void> {
    await this.#toggleMasterActive(year, '통장', name, false)
  }

  async getCategories(year: number): Promise<Category[]> {
    const config = await this.#resolveYearConfig(year)
    const range = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange('카테고리', 'A:D'))
    return parseCategories(range)
  }

  async createCategory(year: number, input: CategoryMutation): Promise<Category> {
    const config = await this.#resolveYearConfig(year)
    this.#assertWriteAllowed(config.spreadsheetId)
    const categories = await this.getCategories(year)
    const name = input.name.trim()
    if (!name) {
      throw new AppError('VALIDATION_ERROR', '카테고리 이름을 입력해주세요.')
    }
    if (categories.some((category) => category.name === name)) {
      throw new AppError('VALIDATION_ERROR', '같은 이름의 카테고리가 이미 있습니다.')
    }
    const nextOrder = (categories.at(-1)?.order ?? 0) + 1
    await this.#sheetsClient.appendValues(config.spreadsheetId, buildRange('카테고리', 'A:D'), [[
      toUserEnteredLiteral(name),
      'TRUE',
      toUserEnteredLiteral(input.budgetGroup?.trim() ?? ''),
      String(nextOrder),
    ]])
    return {
      name,
      active: true,
      budgetGroup: input.budgetGroup?.trim() || undefined,
      order: nextOrder,
    }
  }

  async renameCategory(year: number, previousName: string, nextName: string): Promise<void> {
    await this.#renameMasterAndMonthlyColumn(year, '카테고리', 0, previousName, nextName, 4)
  }

  async disableCategory(year: number, name: string): Promise<void> {
    await this.#toggleMasterActive(year, '카테고리', name, false)
  }

  async getBudgetGroups(year: number): Promise<BudgetGroup[]> {
    const config = await this.#resolveYearConfig(year)
    const range = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange('예산그룹', 'A:D'))
    return parseBudgetGroups(range)
  }

  async getMonthlyBudgetSources(year: number): Promise<MonthlyBudgetSource[]> {
    const config = await this.#resolveYearConfig(year)
    const range = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange('예산월별', 'A:D'))
    return parseMonthlyBudgetSources(range)
  }

  async getMonthlyBudgets(year: number, month: number): Promise<MonthlyBudget[]> {
    const [groups, categories, monthlySources] = await Promise.all([
      this.getBudgetGroups(year),
      this.getCategories(year),
      this.getMonthlyBudgetSources(year),
    ])

    const transactionsByMonth = new Map<number, Transaction[]>()
    for (let currentMonth = 1; currentMonth <= month; currentMonth += 1) {
      transactionsByMonth.set(currentMonth, await this.getMonthTransactions(year, currentMonth))
    }

    const monthZeroCarryOvers = this.#getMonthZeroCarryOvers(groups, monthlySources)
    const timeline = buildBudgetTimeline(
      year,
      groups,
      categories,
      monthlySources,
      transactionsByMonth,
      monthZeroCarryOvers,
    )

    return timeline.filter((item) => item.month === month)
  }

  async updateBudgetAdjustment(
    year: number,
    month: number,
    groupName: string,
    adjustment: number,
  ): Promise<void> {
    const config = await this.#resolveYearConfig(year)
    this.#assertWriteAllowed(config.spreadsheetId)
    const range = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange('예산월별', 'A:D'))
    const rowNumber = this.#findBudgetSourceRow(range, month, groupName)
    await this.#sheetsClient.updateValues(
      config.spreadsheetId,
      buildRowRange('예산월별', rowNumber, 'A:D'),
      [[
        String(month),
        toUserEnteredLiteral(groupName),
        String(this.#readBaseSnapshot(range, rowNumber)),
        String(adjustment),
      ]],
    )
  }

  async resetBudgetCarryOver(year: number, month: number, groupName: string): Promise<void> {
    const budgets = await this.getMonthlyBudgets(year, month)
    const budget = budgets.find((item) => item.groupName === groupName)
    if (!budget) {
      throw new AppError('NOT_FOUND', '예산 그룹을 찾지 못했습니다.')
    }

    await this.updateBudgetAdjustment(
      year,
      month,
      groupName,
      budget.adjustment + resetCarryOverAdjustment(budget.carryOver),
    )
  }

  async linkYear(request: YearLinkRequest): Promise<LinkedYear[]> {
    const currentGraph = await this.getYearGraph()
    if (currentGraph.years.has(request.year)) {
      throw new AppError('VALIDATION_ERROR', '이미 연결된 연도입니다.')
    }
    const previousConfig = currentGraph.years.get(request.year - 1)
    const nextConfig = currentGraph.years.get(request.year + 1)
    if (!previousConfig && !nextConfig) {
      throw new AppError(
        'VALIDATION_ERROR',
        '현재 연결된 연도의 이전 또는 다음 연도만 연결할 수 있습니다.',
      )
    }

    const targetId = this.#extractSpreadsheetId(request.spreadsheetUrl)
    const targetConfig = await this.verifyAccess(targetId)
    if (targetConfig.year !== request.year) {
      throw new AppError('VALIDATION_ERROR', '연도 값과 Spreadsheet 설정이 일치하지 않습니다.')
    }
    if (!this.#isTestYearConfig(targetConfig)) {
      throw new AppError(
        'WRITE_GUARD',
        '연결할 TEST Spreadsheet의 앱설정에 environment = TEST가 필요합니다.',
      )
    }

    // A linked year is writable only when its own human-readable app settings
    // explicitly identify it as a TEST workbook.
    this.#writeAllowedSpreadsheetIds.add(targetConfig.spreadsheetId)

    const updates: Array<{ spreadsheetId: string; values: string[][] }> = [{
      spreadsheetId: targetConfig.spreadsheetId,
      values: this.#buildAppSettingsRows({
        ...targetConfig,
        previousSpreadsheetId: previousConfig?.spreadsheetId,
        nextSpreadsheetId: nextConfig?.spreadsheetId,
      }),
    }]

    if (previousConfig) {
      updates.push({
        spreadsheetId: previousConfig.spreadsheetId,
        values: this.#buildAppSettingsRows({
          ...previousConfig,
          nextSpreadsheetId: targetConfig.spreadsheetId,
        }),
      })
    }

    if (nextConfig) {
      updates.push({
        spreadsheetId: nextConfig.spreadsheetId,
        values: this.#buildAppSettingsRows({
          ...nextConfig,
          previousSpreadsheetId: targetConfig.spreadsheetId,
        }),
      })
    }

    for (const update of updates) {
      this.#assertWriteAllowed(update.spreadsheetId)
    }
    for (const update of updates) {
      await this.#sheetsClient.updateValues(update.spreadsheetId, buildRange('앱설정', 'A:B'), update.values)
    }

    const graph = await this.getYearGraph()
    return [...graph.years.values()]
      .map((config) => ({
        year: config.year,
        spreadsheetId: config.spreadsheetId,
        connected: true,
      }))
      .sort((left, right) => left.year - right.year)
  }

  async syncMonthZero(year: number): Promise<void> {
    const graph = await this.getYearGraph()
    const currentYear = graph.years.get(year)
    const previousYear = graph.years.get(year - 1)
    if (!currentYear || !previousYear) {
      throw new AppError('NOT_FOUND', '이전 연도 연결 정보를 찾지 못했습니다.')
    }

    this.#assertWriteAllowed(currentYear.spreadsheetId)
    const [
      previousDecember,
      currentSnapshot,
      currentBudgetSources,
      currentAccountSnapshot,
      previousDecemberBudgets,
      previousDecemberSettlement,
    ] = await Promise.all([
      this.#sheetsClient.getValues(previousYear.spreadsheetId, buildRange('12', 'A:Z')),
      this.#sheetsClient.getValues(currentYear.spreadsheetId, buildRange('0', 'A:Z')),
      this.#sheetsClient.getValues(currentYear.spreadsheetId, buildRange('예산월별', 'A:D')),
      this.#sheetsClient.getValues(currentYear.spreadsheetId, buildRange('0', 'AB:AC')),
      this.getMonthlyBudgets(year - 1, 12),
      this.getSettlement(year - 1, 12),
    ])
    const sourceRows = previousDecember.values ?? []
    const rowCount = Math.max(sourceRows.length, currentSnapshot.values?.length ?? 0, 1)
    const snapshotRows = Array.from({ length: rowCount }, (_, index) => {
      const row = new Array<string>(26).fill('')
      const source = sourceRows[index] ?? []
      for (let column = 0; column < Math.min(source.length, 26); column += 1) {
        row[column] = source[column]
      }
      return row
    })

    const budgetRows = currentBudgetSources.values ?? []
    let nextBudgetRow = budgetRows.length + 1
    const monthZeroBudgetUpdates = previousDecemberBudgets.map((budget) => {
      const existingIndex = budgetRows.findIndex(
        (row, index) =>
          index > 0 &&
          parseSheetNumber(row[0]) === 0 &&
          trimCell(row[1]) === budget.groupName,
      )
      const rowNumber = existingIndex >= 0 ? existingIndex + 1 : nextBudgetRow++
      return {
        range: buildRowRange('예산월별', rowNumber, 'A:D'),
        values: [[
          '0',
          toUserEnteredLiteral(budget.groupName),
          String(budget.remaining),
          '0',
        ]],
      }
    })

    const openingBalanceRows = [
      ['통장', '연도시작잔액'],
      ...previousDecemberSettlement.accounts.map((account) => [
        toUserEnteredLiteral(account.account),
        String(account.currentMonthBalance),
      ]),
    ]
    const openingBalanceRowCount = Math.max(
      openingBalanceRows.length,
      currentAccountSnapshot.values?.length ?? 0,
      1,
    )
    while (openingBalanceRows.length < openingBalanceRowCount) {
      openingBalanceRows.push(['', ''])
    }

    await this.#sheetsClient.batchUpdateValues(currentYear.spreadsheetId, [
      {
        range: buildRange('0', `A1:Z${rowCount}`),
        values: snapshotRows,
      },
      {
        range: buildRange('0', `AB1:AC${openingBalanceRowCount}`),
        values: openingBalanceRows,
      },
      ...monthZeroBudgetUpdates,
    ])
  }

  async getSettlement(year: number, month: number): Promise<SettlementSummary> {
    assertMonth(month)
    if (month === 0) {
      throw new AppError('VALIDATION_ERROR', '정산은 1월부터 12월까지 조회할 수 있습니다.')
    }

    const config = await this.#resolveYearConfig(year)
    const [accounts, openingBalanceSnapshot, zeroMonthTransactions, ...monthlyTransactions] = await Promise.all([
      this.getAccounts(year),
      this.#sheetsClient.getValues(config.spreadsheetId, buildRange('0', 'AB:AC')),
      this.#getRawMonthTransactions(year, 0),
      ...Array.from({ length: month }, (_, index) =>
        this.#getRawMonthTransactions(year, index + 1),
      ),
    ])
    const transactions = monthlyTransactions[month - 1] ?? []

    const income = transactions
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + Math.abs(item.amount), 0)
    const expense = transactions
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + Math.abs(item.amount), 0)

    const yearStartBalanceByAccount = new Map<string, number>()
    for (const transaction of zeroMonthTransactions) {
      yearStartBalanceByAccount.set(
        transaction.account,
        (yearStartBalanceByAccount.get(transaction.account) ?? 0) + transaction.amount,
      )
    }
    for (const [account, balance] of this.#parseAccountBalanceSnapshot(openingBalanceSnapshot)) {
      yearStartBalanceByAccount.set(account, balance)
    }

    const previousBalanceByAccount = new Map(yearStartBalanceByAccount)
    for (const priorMonthTransactions of monthlyTransactions.slice(0, month - 1)) {
      for (const transaction of priorMonthTransactions) {
        previousBalanceByAccount.set(
          transaction.account,
          (previousBalanceByAccount.get(transaction.account) ?? 0) + transaction.amount,
        )
      }
    }

    const currentBalanceByAccount = new Map(previousBalanceByAccount)
    for (const transaction of monthlyTransactions[month - 1] ?? []) {
      currentBalanceByAccount.set(
        transaction.account,
        (currentBalanceByAccount.get(transaction.account) ?? 0) + transaction.amount,
      )
    }

    return {
      year,
      month,
      income,
      expense,
      accounts: accounts.map((account) => {
        const previousMonthBalance = previousBalanceByAccount.get(account.name) ?? 0
        const currentMonthBalance = currentBalanceByAccount.get(account.name) ?? 0
        return {
          account: account.name,
          previousMonthBalance,
          currentMonthBalance,
          delta: currentMonthBalance - previousMonthBalance,
        }
      }),
    }
  }

  async getInvestmentSummary(year: number, month: number): Promise<InvestmentSummary> {
    const config = await this.#resolveYearConfig(year)
    try {
      const range = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange('투자', 'A:Z'))
      return parseInvestmentSummary(year, month, range)
    } catch (error) {
      return {
        year,
        month,
        metrics: [],
        allocation: [],
        warnings: [error instanceof AppError ? error.userMessage : '투자 Sheet 형식을 확인해주세요.'],
      }
    }
  }

  async getEnergySummary(year: number, month: number): Promise<EnergySummary> {
    const config = await this.#resolveYearConfig(year)
    try {
      const range = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange('에너지', 'A:Z'))
      return parseEnergySummary(year, month, range)
    } catch (error) {
      return {
        year,
        month,
        metrics: [],
        warnings: [error instanceof AppError ? error.userMessage : '에너지 Sheet 형식을 확인해주세요.'],
      }
    }
  }

  async #resolveYearTarget(year: number): Promise<ResolvedYearTarget> {
    const config = await this.#resolveYearConfig(year)
    const spreadsheet = await this.#sheetsClient.getSpreadsheet(config.spreadsheetId)
    return { config, spreadsheet }
  }

  async #resolveYearConfig(year: number): Promise<YearConfig> {
    const cached = this.#connectedYearConfigCache.get(year)
    if (cached) {
      return cached
    }

    const graph = await this.getYearGraph()
    const config = graph.years.get(year)
    if (!config) {
      throw new AppError('NOT_FOUND', '연결된 연도 Sheet를 찾지 못했습니다.')
    }

    return config
  }

  #assertWriteAllowed(spreadsheetId: string): void {
    if (
      !this.#env.testSpreadsheetId ||
      this.#env.testSpreadsheetId !== this.#env.bootstrapSpreadsheetId ||
      !this.#writeAllowedSpreadsheetIds.has(spreadsheetId)
    ) {
      throw new AppError(
        'WRITE_GUARD',
        'TEST Spreadsheet 연결이 확인되지 않아 저장할 수 없습니다.',
      )
    }
  }

  #validateDraft(draft: TransactionDraft): void {
    if (draft.amount <= 0 || !draft.description.trim() || !draft.account.trim()) {
      throw new AppError('VALIDATION_ERROR', '입력값을 다시 확인해주세요.')
    }

    if (draft.type !== 'transfer' && !(draft.category?.trim())) {
      throw new AppError('VALIDATION_ERROR', '카테고리를 선택해주세요.')
    }

    if (draft.type === 'transfer' && (!draft.destinationAccount || draft.destinationAccount === draft.account)) {
      throw new AppError('VALIDATION_ERROR', '출금 통장과 입금 통장을 다시 확인해주세요.')
    }
  }

  #extractAppendedRowNumbers(response: AppendValuesResponse, expectedRows: number): number[] {
    const range = response.updates?.updatedRange
    if (!range) {
      throw new AppError('GOOGLE_API_ERROR', '저장된 행 정보를 확인하지 못했습니다.')
    }

    const match = range.match(/![A-Z]+(\d+):[A-Z]+(\d+)$/)
    if (!match) {
      throw new AppError('GOOGLE_API_ERROR', '저장된 행 범위를 해석하지 못했습니다.')
    }

    const start = Number(match[1])
    const end = Number(match[2])
    const rows = []
    for (let row = start; row <= end; row += 1) {
      rows.push(row)
    }

    if (rows.length !== expectedRows) {
      throw new AppError('GOOGLE_API_ERROR', '저장된 행 수가 예상과 다릅니다.')
    }

    return rows
  }

  async #ensureAppendedMetadata(
    spreadsheetId: string,
    month: number,
    rowNumbers: number[],
    appendRows: ReturnType<typeof buildAppendRows>,
  ): Promise<void> {
    const verification = await this.#sheetsClient.batchGetValues(
      spreadsheetId,
      rowNumbers.map((rowNumber) => buildRowRange(String(month), rowNumber)),
    )

    const updates = verification.valueRanges.flatMap((range, index) => {
      const rowValues = range.values?.[0] ?? []
      const expectedMetadata = appendRows.rows[index]?.slice(23, 26) ?? []
      const currentMetadata = rowValues.slice(23, 26).map(trimCell)
      if (
        expectedMetadata.length === 3 &&
        expectedMetadata.every((value, metadataIndex) =>
          trimCell(value) === currentMetadata[metadataIndex]
        )
      ) {
        return []
      }

      return [{
        range: buildRowRange(String(month), rowNumbers[index], 'X:Z'),
        values: [expectedMetadata],
      }]
    })

    if (updates.length > 0) {
      await this.#sheetsClient.batchUpdateValues(spreadsheetId, updates)
    }
  }

  async #locateTransaction(lookup: TransactionLookup): Promise<LocatedTransaction> {
    assertMonth(lookup.month)
    const config = await this.#resolveYearConfig(lookup.year)
    const range = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange(String(lookup.month), 'A:Z'))
    const transactions = parseTransactions(lookup.year, lookup.month, range.values ?? [])
      .filter((transaction) => transaction.sourceRow !== 1)

    let transaction: Transaction | undefined
    if (lookup.legacyFingerprint && !lookup.transactionId && !lookup.transferId) {
      const candidate = lookup.sourceRow
        ? transactions.find((item) => item.sourceRow === lookup.sourceRow)
        : transactions.find((item) => matchesLegacyFingerprint(item, lookup.legacyFingerprint!))
      if (!candidate || !matchesLegacyFingerprint(candidate, lookup.legacyFingerprint)) {
        throw new AppError(
          'CONFLICT',
          '이 거래가 다른 곳에서 변경되었습니다. 최신 내용을 다시 불러왔습니다.',
        )
      }
      transaction = await this.#claimLegacyTransaction(
        config.spreadsheetId,
        lookup.month,
        candidate,
        lookup.legacyFingerprint,
      )
    } else if (lookup.transactionId) {
      transaction = transactions.find(
        (item) => item.id === lookup.transactionId,
      )
    } else if (lookup.transferId) {
      const transferRows = transactions.filter(
        (item) => item.transferId === lookup.transferId,
      )
      transaction = lookup.sourceRow
        ? transferRows.find((item) => item.sourceRow === lookup.sourceRow) ?? transferRows[0]
        : transferRows[0]
    } else if (lookup.sourceRow) {
      transaction = transactions.find(
        (item) => item.sourceRow === lookup.sourceRow,
      )
    }

    if (!transaction) {
      throw new AppError('NOT_FOUND', '거래를 다시 찾지 못했습니다.')
    }

    const sibling = transaction.transferId
      ? transactions.find((item) => item.transferId === transaction.transferId && item.sourceRow !== transaction.sourceRow)
      : undefined

    return {
      transaction,
      sibling,
      spreadsheetId: config.spreadsheetId,
    }
  }

  async #claimLegacyTransaction(
    spreadsheetId: string,
    month: number,
    transaction: Transaction,
    fingerprint: LegacyTransactionFingerprint,
  ): Promise<Transaction> {
    this.#assertWriteAllowed(spreadsheetId)
    if (!matchesLegacyFingerprint(transaction, fingerprint)) {
      throw new AppError(
        'CONFLICT',
        '이 거래가 다른 곳에서 변경되었습니다. 최신 내용을 다시 불러왔습니다.',
      )
    }
    if (transaction.id || !transaction.sourceRow) {
      return transaction
    }

    const transactionId = `txn_${crypto.randomUUID().replaceAll('-', '')}`
    const nextRow = [...(transaction.rawValues ?? [])]
    while (nextRow.length < 26) {
      nextRow.push('')
    }
    nextRow[23] = transaction.type === 'unknown' ? '' : transaction.type
    nextRow[24] = transactionId
    await this.#sheetsClient.updateValues(
      spreadsheetId,
      buildRowRange(String(month), transaction.sourceRow),
      [nextRow],
    )

    return {
      ...transaction,
      id: transactionId,
      metadataMissing: false,
      rawValues: nextRow,
    }
  }

  async #updateRowValues(
    spreadsheetId: string,
    month: number,
    rowNumber: number,
    rowValues: string[],
  ): Promise<void> {
    this.#assertWriteAllowed(spreadsheetId)
    await this.#sheetsClient.updateValues(
      spreadsheetId,
      buildRowRange(String(month), rowNumber),
      [rowValues],
    )
  }

  async #renameMasterAndMonthlyColumn(
    year: number,
    masterSheet: '통장' | '카테고리',
    masterNameColumnIndex: number,
    previousName: string,
    nextName: string,
    monthColumnIndex: number,
  ): Promise<void> {
    const config = await this.#resolveYearConfig(year)
    this.#assertWriteAllowed(config.spreadsheetId)

    const masterRange = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange(masterSheet, 'A:D'))
    const rows = masterRange.values ?? []
    const rowIndex = rows.findIndex((row, index) => index > 0 && trimCell(row[masterNameColumnIndex]) === previousName)
    if (rowIndex < 0) {
      throw new AppError('NOT_FOUND', '이름을 바꿀 항목을 찾지 못했습니다.')
    }

    const normalizedNextName = nextName.trim()
    if (!normalizedNextName) {
      throw new AppError('VALIDATION_ERROR', '새 이름을 입력해주세요.')
    }
    if (rows.some((row, index) =>
      index > 0 &&
      index !== rowIndex &&
      trimCell(row[masterNameColumnIndex]) === normalizedNextName,
    )) {
      throw new AppError('VALIDATION_ERROR', '같은 이름의 항목이 이미 있습니다.')
    }

    const nextMasterRow = [...rows[rowIndex]]
    nextMasterRow[masterNameColumnIndex] = toUserEnteredLiteral(normalizedNextName)
    await this.#sheetsClient.updateValues(
      config.spreadsheetId,
      buildRowRange(masterSheet, rowIndex + 1, 'A:D'),
      [nextMasterRow],
    )

    for (let month = 1; month <= 12; month += 1) {
      const monthRange = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange(String(month), 'A:Z'))
      const updates = (monthRange.values ?? [])
        .map((row, rowIndexInMonth) => ({ row, rowNumber: rowIndexInMonth + 1 }))
        .filter(({ row, rowNumber }) => rowNumber > 1 && trimCell(row[monthColumnIndex]) === previousName)
        .map(({ row, rowNumber }) => {
          const nextRow = [...row]
          while (nextRow.length < 26) {
            nextRow.push('')
          }
          nextRow[monthColumnIndex] = toUserEnteredLiteral(normalizedNextName)
          return {
            range: buildRowRange(String(month), rowNumber),
            values: [nextRow],
          }
        })

      if (updates.length > 0) {
        await this.#sheetsClient.batchUpdateValues(config.spreadsheetId, updates)
      }
    }
  }

  async #toggleMasterActive(year: number, masterSheet: '통장' | '카테고리', name: string, active: boolean): Promise<void> {
    const config = await this.#resolveYearConfig(year)
    this.#assertWriteAllowed(config.spreadsheetId)
    const range = await this.#sheetsClient.getValues(config.spreadsheetId, buildRange(masterSheet, 'A:D'))
    const rows = range.values ?? []
    const rowIndex = rows.findIndex((row, index) => index > 0 && trimCell(row[0]) === name)
    if (rowIndex < 0) {
      throw new AppError('NOT_FOUND', '항목을 찾지 못했습니다.')
    }

    const nextRow = [...rows[rowIndex]]
    nextRow[1] = active ? 'TRUE' : 'FALSE'
    await this.#sheetsClient.updateValues(
      config.spreadsheetId,
      buildRowRange(masterSheet, rowIndex + 1, 'A:D'),
      [nextRow],
    )
  }

  #findSheetId(spreadsheet: SheetsSpreadsheet, sheetName: string): number {
    const sheetId = spreadsheet.sheets?.find((sheet) => sheet.properties?.title === sheetName)?.properties?.sheetId
    if (sheetId === undefined) {
      throw new AppError('SCHEMA_MISMATCH', '월별 Sheet를 찾지 못했습니다.')
    }

    return sheetId
  }

  #findBudgetSourceRow(range: SheetsValueRange, month: number, groupName: string): number {
    const rows = range.values ?? []
    const rowIndex = rows.findIndex(
      (row, index) =>
        index > 0 &&
        parseSheetNumber(row[0]) === month &&
        trimCell(row[1]) === groupName,
    )
    if (rowIndex < 0) {
      throw new AppError('NOT_FOUND', '예산월별 행을 찾지 못했습니다.')
    }

    return rowIndex + 1
  }

  #readBaseSnapshot(range: SheetsValueRange, rowNumber: number): number {
    return parseSheetNumber(range.values?.[rowNumber - 1]?.[2])
  }

  #getMonthZeroCarryOvers(
    groups: BudgetGroup[],
    monthlySources: MonthlyBudgetSource[],
  ): Record<string, number> {
    const sourceByGroup = new Map(
      monthlySources
        .filter((source) => source.month === 0)
        .map((source) => [source.groupName, source.baseSnapshot]),
    )

    return Object.fromEntries(
      groups.map((group) => [group.name, sourceByGroup.get(group.name) ?? 0]),
    )
  }

  #parseAccountBalanceSnapshot(range: SheetsValueRange): Map<string, number> {
    const balances = new Map<string, number>()
    for (const [index, row] of (range.values ?? []).entries()) {
      const account = trimCell(row[0])
      if (index === 0 || !account) {
        continue
      }
      balances.set(account, parseSheetNumber(row[1]))
    }
    return balances
  }

  #extractSpreadsheetId(urlOrId: string): string {
    const directMatch = urlOrId.match(/^[a-zA-Z0-9-_]+$/)
    if (directMatch) {
      return urlOrId
    }

    const urlMatch = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!urlMatch) {
      throw new AppError('VALIDATION_ERROR', 'Spreadsheet URL 형식을 확인해주세요.')
    }

    return urlMatch[1]
  }

  #buildAppSettingsRows(config: YearConfig): string[][] {
    return [
      ['key', 'value'],
      ['year', String(config.year)],
      ['schemaVersion', String(config.schemaVersion)],
      ['environment', toUserEnteredLiteral(config.environment ?? '')],
      ['previousSpreadsheetId', toUserEnteredLiteral(config.previousSpreadsheetId ?? '')],
      ['nextSpreadsheetId', toUserEnteredLiteral(config.nextSpreadsheetId ?? '')],
      ['createdAt', toUserEnteredLiteral(config.createdAt ?? '')],
      ['updatedAt', new Date().toISOString()],
    ]
  }

  #isTestYearConfig(config: YearConfig): boolean {
    return config.environment?.trim().toUpperCase() === 'TEST'
  }

  #buildMoveRequestId(
    transaction: Transaction,
    targetType: TransactionDraft['type'],
  ): string | undefined {
    const sourceId = transaction.transferId ?? transaction.id
    if (!sourceId) {
      return undefined
    }

    const sourcePrefix = transaction.transferId ? 'trf' : 'txn'
    const targetPrefix = targetType === 'transfer' ? 'trf' : 'txn'
    return sourcePrefix === targetPrefix
      ? sourceId.replace(/^(txn|trf)_/, '')
      : `move_${sourceId}`
  }

  #buildSavedTransfer(
    first: Transaction | undefined,
    second: Transaction | undefined,
  ): SavedTransactionResult {
    const rows = [first, second].filter((item): item is Transaction => Boolean(item))
    const outgoing = rows.find((transaction) => transaction.amount < 0)
    const incoming = rows.find((transaction) => transaction.amount > 0)
    if (!outgoing || !incoming || outgoing.transferId !== incoming.transferId) {
      throw new AppError('TRANSFER_INTEGRITY', '연결된 이체 거래를 확인하지 못했습니다.')
    }

    return {
      transaction: {
        ...outgoing,
        destinationAccount: incoming.account,
        metadataMissing: false,
      },
      relatedTransaction: incoming,
    }
  }

  #mergeUpdatedLedgerRow(
    original: string[] | undefined,
    updated: string[],
  ): string[] {
    const merged = [...(original ?? [])]
    while (merged.length < 26) merged.push('')
    for (const column of [0, 1, 2, 3, 4, 23, 24, 25]) {
      merged[column] = updated[column] ?? ''
    }
    return merged
  }
}
