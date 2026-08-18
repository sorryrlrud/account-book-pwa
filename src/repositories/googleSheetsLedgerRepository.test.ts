import { describe, expect, it, vi } from 'vitest'
import { AppError } from '@/domain/errors.ts'
import { GoogleSheetsLedgerRepository } from './googleSheetsLedgerRepository.ts'
import { InMemoryTokenStore } from '@/services/googleAuth/tokenStore.ts'
import { buildRange, buildRowRange } from '@/utils/sheets.ts'
import {
  buildTransactionRow,
  createLedgerWorkbook,
  FakeSheetsClient,
  type WorkbookSeed,
} from '../../tests/fakes/fakeSheetsClient.ts'

interface HarnessOptions {
  bootstrapSpreadsheetId?: string
  workbooks?: WorkbookSeed[]
  stripTransactionIdsOnAppend?: boolean
  stripTransferIdsOnAppend?: boolean
}

function createHarness(options: HarnessOptions = {}) {
  const bootstrapSpreadsheetId = options.bootstrapSpreadsheetId ?? 'sheet-2026'
  const fakeSheetsClient = new FakeSheetsClient(
    options.workbooks ?? createDefaultWorkbooks(),
    {
      stripTransactionIdsOnAppend: options.stripTransactionIdsOnAppend,
      stripTransferIdsOnAppend: options.stripTransferIdsOnAppend,
    },
  )
  const tokenStore = new InMemoryTokenStore()
  tokenStore.set({
    accessToken: 'sheet-token',
    expiresAt: Date.now() + 60_000,
    scopes: ['spreadsheets'],
  })

  const repository = new GoogleSheetsLedgerRepository({
    env: {
      googleClientId: 'client-id',
      bootstrapSpreadsheetId,
    },
    tokenStore,
    sheetsClient: fakeSheetsClient as never,
  })

  return {
    repository,
    fakeSheetsClient,
  }
}

function createDefaultWorkbooks(): WorkbookSeed[] {
  return [
    createLedgerWorkbook({
      spreadsheetId: 'sheet-2025',
      year: 2025,
      nextSpreadsheetId: 'sheet-2026',
      sheetValues: {
        '1': [
          [],
          buildTransactionRow({
            date: '2025-01-03',
            amount: -4500,
            description: 'Previous year row',
            account: 'Checking',
            category: 'Food',
            type: 'expense',
            transactionId: 'txn_prev_year',
          }),
        ],
        '12': [
          [],
          buildTransactionRow({
            date: '2025-12-31',
            amount: 990000,
            description: 'Carry over',
            account: 'Savings',
            category: 'Carry',
            type: 'income',
            transactionId: 'txn_prev_december',
          }),
        ],
      },
    }),
    createLedgerWorkbook({
      spreadsheetId: 'sheet-2026',
      year: 2026,
      previousSpreadsheetId: 'sheet-2025',
      sheetValues: {
        '0': [
          [],
          buildTransactionRow({
            date: '2026-01-01',
            amount: 100000,
            description: 'Month zero snapshot',
            account: 'Checking',
            category: 'Food',
            type: 'income',
            transactionId: 'txn_month_zero',
          }),
        ],
        '1': [
          [],
          buildTransactionRow({
            date: '2026-01-05',
            amount: -22000,
            description: 'January meal',
            account: 'Checking',
            category: 'Food',
            type: 'expense',
            transactionId: 'txn_january',
          }),
        ],
        '8': [
          [],
          withLegacyCalculatedCells(buildTransactionRow({
            date: '2026-08-09',
            amount: -12000,
            description: 'Coffee beans',
            account: 'Checking',
            category: 'Food',
            type: 'expense',
            transactionId: 'txn_existing',
          }), 'expense-row'),
          withLegacyCalculatedCells(buildTransactionRow({
            date: '2026-08-10',
            amount: -50000,
            description: 'Savings move',
            account: 'Checking',
            type: 'transfer',
            transferId: 'trf_existing',
          }), 'transfer-out'),
          withLegacyCalculatedCells(buildTransactionRow({
            date: '2026-08-10',
            amount: 50000,
            description: 'Savings move',
            account: 'Savings',
            type: 'transfer',
            transferId: 'trf_existing',
          }), 'transfer-in'),
          buildTransactionRow({
            date: '2026-08-11',
            amount: -6000,
            description: 'Legacy lunch',
            account: 'Checking',
            category: 'Food',
          }),
          buildTransactionRow({
            date: '2026-08-12',
            amount: -18000,
            description: 'Rename candidate',
            account: 'Checking',
            category: 'Food',
            type: 'expense',
            transactionId: 'txn_rename',
          }),
        ],
        '12': [
          [],
          buildTransactionRow({
            date: '2026-12-01',
            amount: -8000,
            description: 'December meal',
            account: 'Checking',
            category: 'Food',
            type: 'expense',
            transactionId: 'txn_december',
          }),
        ],
      },
    }),
    createLedgerWorkbook({
      spreadsheetId: 'sheet-2027',
      year: 2027,
    }),
  ]
}

function withOpeningBalanceSnapshot(
  row: string[],
  account: string,
  balance: string,
): string[] {
  const nextRow = [...row]
  while (nextRow.length < 29) nextRow.push('')
  nextRow[27] = account
  nextRow[28] = balance
  return nextRow
}

function withLegacyCalculatedCells(row: string[], marker: string): string[] {
  const nextRow = [...row]
  nextRow[5] = `=${marker}-legacy-formula`
  nextRow[10] = `${marker}-summary`
  nextRow[22] = `${marker}-legacy-tail`
  return nextRow
}

describe('GoogleSheetsLedgerRepository', () => {
  it('reuses the verified bootstrap config instead of loading the root twice', async () => {
    const { repository, fakeSheetsClient } = createHarness()
    const getSpreadsheet = vi.spyOn(fakeSheetsClient, 'getSpreadsheet')
    const getValues = vi.spyOn(fakeSheetsClient, 'getValues')

    await repository.bootstrap()

    expect(
      getSpreadsheet.mock.calls.filter(([spreadsheetId]) => spreadsheetId === 'sheet-2026'),
    ).toHaveLength(1)
    expect(
      getValues.mock.calls.filter(
        ([spreadsheetId, range]) =>
          spreadsheetId === 'sheet-2026' && range === buildRange('앱설정', 'A:B'),
      ),
    ).toHaveLength(1)
  })

  it('builds settlement balances from month 0 plus prior months and uses only the selected month for income and expense totals', async () => {
    const { repository } = createHarness({
      workbooks: [
        createLedgerWorkbook({
          spreadsheetId: 'sheet-2026',
          year: 2026,
          sheetValues: {
            통장: [
              ['name', 'active', 'assetGroup', 'order'],
              ['Checking', 'TRUE', 'cash', '1'],
              ['Savings', 'TRUE', 'cash', '2'],
            ],
            '0': [
              withOpeningBalanceSnapshot([], '통장', '연도시작잔액'),
              withOpeningBalanceSnapshot(buildTransactionRow({
                date: '2026-01-01',
                amount: 1000,
                description: 'Opening checking',
                account: 'Checking',
                category: 'Carry',
                type: 'income',
                transactionId: 'txn_open_checking',
              }), 'Checking', '2000'),
              withOpeningBalanceSnapshot(buildTransactionRow({
                date: '2026-01-01',
                amount: 500,
                description: 'Opening savings',
                account: 'Savings',
                category: 'Carry',
                type: 'income',
                transactionId: 'txn_open_savings',
              }), 'Savings', '1000'),
            ],
            '1': [
              [],
              buildTransactionRow({
                date: '2026-01-05',
                amount: 100,
                description: 'Salary top-up',
                account: 'Checking',
                category: 'Salary',
                type: 'income',
                transactionId: 'txn_jan_income',
              }),
              buildTransactionRow({
                date: '2026-01-06',
                amount: -20,
                description: 'January lunch',
                account: 'Checking',
                category: 'Food',
                type: 'expense',
                transactionId: 'txn_jan_expense',
              }),
              buildTransactionRow({
                date: '2026-01-10',
                amount: -50,
                description: 'Move to savings',
                account: 'Checking',
                type: 'transfer',
                transferId: 'trf_january',
              }),
              buildTransactionRow({
                date: '2026-01-10',
                amount: 50,
                description: 'Move to savings',
                account: 'Savings',
                type: 'transfer',
                transferId: 'trf_january',
              }),
            ],
            '2': [
              [],
              buildTransactionRow({
                date: '2026-02-03',
                amount: -30,
                description: 'February groceries',
                account: 'Savings',
                category: 'Food',
                type: 'expense',
                transactionId: 'txn_feb_expense',
              }),
              buildTransactionRow({
                date: '2026-02-20',
                amount: 200,
                description: 'Bonus deposit',
                account: 'Savings',
                category: 'Salary',
                type: 'income',
                transactionId: 'txn_feb_income',
              }),
            ],
          },
        }),
      ],
    })

    const settlement = await repository.getSettlement(2026, 2)

    expect(settlement).toEqual({
      year: 2026,
      month: 2,
      income: 200,
      expense: 30,
      accounts: [
        {
          account: 'Checking',
          previousMonthBalance: 2030,
          currentMonthBalance: 2030,
          delta: 0,
        },
        {
          account: 'Savings',
          previousMonthBalance: 1050,
          currentMonthBalance: 1220,
          delta: 170,
        },
      ],
    })
  })

  it('writes signed expense rows with metadata in A:E and X:Z', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-1111-1111-111111111111',
    )
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()

    const saved = await repository.appendTransaction({
      type: 'expense',
      date: '2026-08-15',
      amount: 12345,
      description: 'Lunch set',
      account: 'Checking',
      category: 'Food',
    })

    expect(fakeSheetsClient.appendCalls).toHaveLength(1)
    expect(fakeSheetsClient.appendCalls[0]).toMatchObject({
      spreadsheetId: 'sheet-2026',
      range: buildRange('8', 'A:E'),
    })
    expect(fakeSheetsClient.appendCalls[0]?.values[0]).toEqual([
      '2026-08-15',
      '-12345',
      'Lunch set',
      'Checking',
      'Food',
    ])
    expect(fakeSheetsClient.batchUpdateValuesCalls[0]?.data).toEqual([
      {
        range: expect.stringMatching(/'8'!X\d+:Z\d+/),
        values: [[
          'expense',
          'txn_11111111111111111111111111111111',
          '',
        ]],
      },
    ])
    expect(saved.transaction).toMatchObject({
      type: 'expense',
      amount: -12345,
      description: 'Lunch set',
      account: 'Checking',
      category: 'Food',
      id: 'txn_11111111111111111111111111111111',
    })
  })

  it('returns an existing row when the same client request is retried', async () => {
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()
    const draft = {
      clientRequestId: 'request-safe-retry',
      type: 'expense' as const,
      date: '2026-08-15',
      amount: 12345,
      description: 'Retry-safe lunch',
      account: 'Checking',
      category: 'Food',
    }

    const first = await repository.appendTransaction(draft)
    const second = await repository.appendTransaction(draft)

    expect(fakeSheetsClient.appendCalls).toHaveLength(1)
    expect(second.transaction.id).toBe(first.transaction.id)
    expect(second.transaction.id).toBe('txn_requestsaferetry')
  })

  it('repairs missing metadata on the exact appended row and returns the saved transaction', async () => {
    const { repository, fakeSheetsClient } = createHarness({
      stripTransactionIdsOnAppend: true,
    })
    await repository.getYearGraph()

    const saved = await repository.appendTransaction({
      clientRequestId: 'repair-missing-id',
      type: 'expense',
      date: '2026-08-15',
      amount: 3000,
      description: 'Metadata repair',
      account: 'Checking',
      category: 'Food',
    })

    expect(saved.transaction).toMatchObject({
      id: 'txn_repairmissingid',
      description: 'Metadata repair',
      amount: -3000,
    })
    expect(fakeSheetsClient.appendCalls).toHaveLength(1)
    expect(fakeSheetsClient.batchUpdateValuesCalls).toHaveLength(1)
    expect(fakeSheetsClient.batchUpdateValuesCalls[0]?.data).toEqual([
      {
        range: expect.stringMatching(/'8'!X\d+:Z\d+/),
        values: [['expense', 'txn_repairmissingid', '']],
      },
    ])

    const stored = (await repository.getMonthTransactions(2026, 8)).find(
      (transaction) => transaction.description === 'Metadata repair',
    )
    expect(stored?.id).toBe('txn_repairmissingid')
  })

  it('returns an existing transfer pair when the same client request is retried', async () => {
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()
    const draft = {
      clientRequestId: 'transfer-safe-retry',
      type: 'transfer' as const,
      date: '2026-08-16',
      amount: 50000,
      description: 'Retry-safe transfer',
      account: 'Checking',
      destinationAccount: 'Savings',
    }

    const first = await repository.appendTransaction(draft)
    const second = await repository.appendTransaction(draft)

    expect(fakeSheetsClient.appendCalls).toHaveLength(1)
    expect(second.transaction.transferId).toBe(first.transaction.transferId)
    expect(second.relatedTransaction?.transferId).toBe(first.relatedTransaction?.transferId)
    expect(second.transaction).toMatchObject({
      account: 'Checking',
      destinationAccount: 'Savings',
      amount: -50000,
    })
  })

  it('appends transfer rows once with one shared transfer id', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '22222222-2222-2222-2222-222222222222',
    )
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()

    const saved = await repository.appendTransaction({
      type: 'transfer',
      date: '2026-08-16',
      amount: 50000,
      description: 'Split reserve',
      account: 'Checking',
      destinationAccount: 'Savings',
    })

    expect(fakeSheetsClient.appendCalls).toHaveLength(1)
    expect(fakeSheetsClient.appendCalls[0]?.values).toEqual([
      [
        '2026-08-16',
        '-50000',
        'Split reserve',
        'Checking',
        '',
      ],
      [
        '2026-08-16',
        '50000',
        'Split reserve',
        'Savings',
        '',
      ],
    ])
    expect(fakeSheetsClient.batchUpdateValuesCalls).toHaveLength(1)
    expect(fakeSheetsClient.batchUpdateValuesCalls[0]?.data).toEqual([
      {
        range: expect.stringMatching(/'8'!X\d+:Z\d+/),
        values: [['transfer', '', 'trf_22222222222222222222222222222222']],
      },
      {
        range: expect.stringMatching(/'8'!X\d+:Z\d+/),
        values: [['transfer', '', 'trf_22222222222222222222222222222222']],
      },
    ])
    expect(saved.transaction.transferId).toBe('trf_22222222222222222222222222222222')
    expect(saved.relatedTransaction?.transferId).toBe('trf_22222222222222222222222222222222')
    expect(saved.transaction).toMatchObject({
      account: 'Checking',
      destinationAccount: 'Savings',
      amount: -50000,
    })

    const logicalTransfers = (await repository.getMonthTransactions(2026, 8))
      .filter((transaction) => transaction.transferId === saved.transaction.transferId)
    expect(logicalTransfers).toHaveLength(1)
    expect(logicalTransfers[0]).toMatchObject({
      account: 'Checking',
      destinationAccount: 'Savings',
      amount: -50000,
    })
  })

  it('exposes transfer metadata follow-up failures without re-appending rows', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '33333333-3333-3333-3333-333333333333',
    )
    const { repository, fakeSheetsClient } = createHarness({
      stripTransferIdsOnAppend: true,
    })
    fakeSheetsClient.failNextBatchUpdateValues = new Error('metadata write failed')
    await repository.getYearGraph()

    await expect(
      repository.appendTransaction({
        type: 'transfer',
        date: '2026-08-17',
        amount: 70000,
        description: 'Broken transfer',
        account: 'Checking',
        destinationAccount: 'Savings',
      }),
    ).rejects.toMatchObject({
      code: 'TRANSFER_INTEGRITY',
    })

    expect(fakeSheetsClient.appendCalls).toHaveLength(1)
    expect(fakeSheetsClient.batchUpdateValuesCalls).toHaveLength(1)

    const transactions = await repository.getMonthTransactions(2026, 8)
    const broken = transactions.filter((transaction) => transaction.description === 'Broken transfer')
    expect(broken).toHaveLength(2)
    expect(broken.every((transaction) => transaction.type === 'unknown')).toBe(true)
    expect(broken.every((transaction) => transaction.metadataMissing)).toBe(true)
    expect(broken.every((transaction) => transaction.transferId === undefined)).toBe(true)
  })

  it('updates by transaction id and deletes both transfer siblings by transfer id', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('44444444-4444-4444-4444-444444444444')
      .mockReturnValueOnce('55555555-5555-5555-5555-555555555555')
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()

    const updated = await repository.updateTransaction(
      {
        year: 2026,
        month: 8,
        transactionId: 'txn_existing',
        sourceRow: 5,
      },
      {
        type: 'expense',
        date: '2026-08-09',
        amount: 15000,
        description: 'Coffee beans refill',
        account: 'Checking',
        category: 'Food',
      },
    )

    expect(updated.transaction).toMatchObject({
      description: 'Coffee beans refill',
      amount: -15000,
      id: 'txn_existing',
    })
    expect(fakeSheetsClient.updateCalls[0]).toMatchObject({
      spreadsheetId: 'sheet-2026',
      range: buildRowRange('8', 2),
    })
    expect(fakeSheetsClient.updateCalls[0]?.values[0]?.[24]).toBe('txn_existing')
    expect(fakeSheetsClient.updateCalls[0]?.values[0]?.slice(5, 23)).toEqual([
      '=expense-row-legacy-formula',
      ...new Array<string>(4).fill(''),
      'expense-row-summary',
      ...new Array<string>(11).fill(''),
      'expense-row-legacy-tail',
    ])

    await repository.deleteTransaction({
      year: 2026,
      month: 8,
      transferId: 'trf_existing',
    })

    expect(fakeSheetsClient.batchUpdateCalls).toHaveLength(1)
    expect(fakeSheetsClient.batchUpdateCalls[0]?.requests).toEqual([
      {
        deleteDimension: {
          range: {
            sheetId: 109,
            dimension: 'ROWS',
            startIndex: 3,
            endIndex: 4,
          },
        },
      },
      {
        deleteDimension: {
          range: {
            sheetId: 109,
            dimension: 'ROWS',
            startIndex: 2,
            endIndex: 3,
          },
        },
      },
    ])

    const rows = fakeSheetsClient.getSheetValues('sheet-2026', '8')
    expect(rows.some((row: string[]) => row[25] === 'trf_existing')).toBe(false)
  })

  it('updates both transfer rows in place and preserves their transfer id', async () => {
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()

    const saved = await repository.updateTransaction(
      {
        year: 2026,
        month: 8,
        transferId: 'trf_existing',
        sourceRow: 3,
      },
      {
        type: 'transfer',
        date: '2026-08-10',
        amount: 70000,
        description: 'Updated savings move',
        account: 'Checking',
        destinationAccount: 'Savings',
      },
    )

    expect(fakeSheetsClient.appendCalls).toHaveLength(0)
    expect(fakeSheetsClient.batchUpdateValuesCalls).toHaveLength(1)
    expect(fakeSheetsClient.batchUpdateValuesCalls[0]?.data).toMatchObject([
      {
        range: buildRowRange('8', 3),
        values: [expect.arrayContaining(['-70000', 'Updated savings move', 'Checking'])],
      },
      {
        range: buildRowRange('8', 4),
        values: [expect.arrayContaining(['70000', 'Updated savings move', 'Savings'])],
      },
    ])
    expect(fakeSheetsClient.batchUpdateValuesCalls[0]?.data[0]?.values[0]?.[5]).toBe(
      '=transfer-out-legacy-formula',
    )
    expect(fakeSheetsClient.batchUpdateValuesCalls[0]?.data[1]?.values[0]?.[5]).toBe(
      '=transfer-in-legacy-formula',
    )
    expect(saved.transaction).toMatchObject({
      transferId: 'trf_existing',
      account: 'Checking',
      destinationAccount: 'Savings',
      amount: -70000,
    })
    expect(saved.relatedTransaction?.transferId).toBe('trf_existing')
  })

  it('retries a cross-month move without appending the destination twice', async () => {
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()
    const lookup = {
      year: 2026,
      month: 8,
      transactionId: 'txn_existing',
      sourceRow: 2,
    }
    const draft = {
      type: 'expense' as const,
      date: '2026-09-01',
      amount: 15000,
      description: 'Moved coffee beans',
      account: 'Checking',
      category: 'Food',
    }
    fakeSheetsClient.failNextBatchUpdate = new Error('delete response failed')

    await expect(repository.updateTransaction(lookup, draft)).rejects.toMatchObject({
      code: 'CONFLICT',
    })
    expect(fakeSheetsClient.appendCalls).toHaveLength(1)

    const saved = await repository.updateTransaction(lookup, draft)

    expect(fakeSheetsClient.appendCalls).toHaveLength(1)
    expect(saved.transaction.id).toBe('txn_existing')
    expect(
      fakeSheetsClient.getSheetValues('sheet-2026', '8')
        .filter((row) => row[24] === 'txn_existing'),
    ).toHaveLength(0)
    expect(
      fakeSheetsClient.getSheetValues('sheet-2026', '9')
        .filter((row) => row[24] === 'txn_existing'),
    ).toHaveLength(1)
  })

  it('claims legacy fingerprint rows before updating them', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('66666666-6666-6666-6666-666666666666')
      .mockReturnValueOnce('77777777-7777-7777-7777-777777777777')
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()

    const saved = await repository.updateTransaction(
      {
        year: 2026,
        month: 8,
        legacyFingerprint: {
          date: '2026-08-11',
          amount: -6000,
          description: 'Legacy lunch',
          account: 'Checking',
          category: 'Food',
        },
      },
      {
        type: 'expense',
        date: '2026-08-11',
        amount: 6500,
        description: 'Legacy lunch corrected',
        account: 'Checking',
        category: 'Food',
      },
    )

    expect(fakeSheetsClient.updateCalls).toHaveLength(2)
    expect(fakeSheetsClient.updateCalls[0]?.values[0]?.[24]).toBe(
      'txn_66666666666666666666666666666666',
    )
    expect(fakeSheetsClient.updateCalls[1]?.values[0]?.[24]).toBe(
      'txn_66666666666666666666666666666666',
    )
    expect(saved.transaction).toMatchObject({
      description: 'Legacy lunch corrected',
      amount: -6500,
      id: 'txn_66666666666666666666666666666666',
      metadataMissing: false,
    })
  })

  it('raises a conflict when a legacy fingerprint no longer matches the claimed source row', async () => {
    const { repository } = createHarness()
    await repository.getYearGraph()

    await expect(
      repository.updateTransaction(
        {
          year: 2026,
          month: 8,
          sourceRow: 5,
          legacyFingerprint: {
            date: '2026-08-11',
            amount: -9999,
            description: 'Legacy lunch',
            account: 'Checking',
            category: 'Food',
          },
        },
        {
          type: 'expense',
          date: '2026-08-11',
          amount: 6500,
          description: 'Legacy lunch corrected',
          account: 'Checking',
          category: 'Food',
        },
      ),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
    })
  })

  it('loads account and category master data with active state ordering', async () => {
    const { repository } = createHarness()

    const [accounts, categories] = await Promise.all([
      repository.getAccounts(2026),
      repository.getCategories(2026),
    ])

    expect(accounts).toEqual([
      {
        name: 'Checking',
        active: false,
        assetGroup: 'cash',
        order: 1,
      },
      {
        name: 'Savings',
        active: true,
        assetGroup: 'cash',
        order: 2,
      },
    ])
    expect(categories).toEqual([
      {
        name: 'Food',
        active: false,
        budgetGroup: 'Living',
        order: 1,
      },
      {
        name: 'Bills',
        active: true,
        budgetGroup: 'Living',
        order: 2,
      },
    ])
  })

  it('loads all budget inputs in one batch request', async () => {
    const { repository, fakeSheetsClient } = createHarness()

    const budgets = await repository.getMonthlyBudgets(2026, 8)

    expect(budgets.find((budget) => budget.groupName === 'Living')?.spent).toBe(36000)
    expect(fakeSheetsClient.batchGetValuesCalls).toHaveLength(1)
    expect(fakeSheetsClient.batchGetValuesCalls[0]?.ranges).toEqual([
      buildRange('예산그룹', 'A:D'),
      buildRange('카테고리', 'A:D'),
      buildRange('예산월별', 'A:D'),
      ...Array.from({ length: 8 }, (_, index) => buildRange(String(index + 1), 'A:Z')),
    ])
  })

  it('creates a missing monthly budget row when its first adjustment is saved', async () => {
    const { repository, fakeSheetsClient } = createHarness()

    await repository.updateBudgetAdjustment(2026, 2, 'Living', -300000)

    expect(fakeSheetsClient.getSheetValues('sheet-2026', '예산월별').at(-1)).toEqual([
      '2',
      'Living',
      '1000000',
      '-300000',
    ])
  })

  it('creates budget groups and updates their default monthly budget', async () => {
    const { repository, fakeSheetsClient } = createHarness()

    await repository.createBudgetGroup(2026, { name: 'Travel', baseMonthlyBudget: 250000 })
    await repository.updateBudgetGroupBase(2026, 'Travel', 300000)

    expect(fakeSheetsClient.getSheetValues('sheet-2026', '예산그룹').at(-1)).toEqual([
      'Travel',
      '300000',
      'TRUE',
      '2',
    ])
  })

  it('renames account and category labels only on the current year months 1 through 12', async () => {
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()

    await repository.renameAccount(2026, 'Checking', 'Main Checking')
    await repository.renameCategory(2026, 'Food', 'Dining')

    expect(fakeSheetsClient.getSheetValues('sheet-2026', '통장')[1]?.[0]).toBe('Main Checking')
    expect(fakeSheetsClient.getSheetValues('sheet-2026', '카테고리')[1]?.[0]).toBe('Dining')
    expect(fakeSheetsClient.getSheetValues('sheet-2026', '1')[1]?.[3]).toBe('Main Checking')
    expect(fakeSheetsClient.getSheetValues('sheet-2026', '1')[1]?.[4]).toBe('Dining')
    expect(fakeSheetsClient.getSheetValues('sheet-2026', '8')[1]?.[3]).toBe('Main Checking')
    expect(fakeSheetsClient.getSheetValues('sheet-2026', '8')[1]?.[4]).toBe('Dining')
    expect(fakeSheetsClient.getSheetValues('sheet-2026', '12')[1]?.[3]).toBe('Main Checking')
    expect(fakeSheetsClient.getSheetValues('sheet-2026', '12')[1]?.[4]).toBe('Dining')
    expect(fakeSheetsClient.getSheetValues('sheet-2026', '0')[1]?.[3]).toBe('Checking')
    expect(fakeSheetsClient.getSheetValues('sheet-2026', '0')[1]?.[4]).toBe('Food')
    expect(fakeSheetsClient.getSheetValues('sheet-2025', '1')[1]?.[3]).toBe('Checking')
    expect(fakeSheetsClient.getSheetValues('sheet-2025', '1')[1]?.[4]).toBe('Food')
  })

  it('allows writes to configured linked years regardless of the environment label', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '88888888-8888-8888-8888-888888888888',
    )
    const { repository, fakeSheetsClient } = createHarness()
    await repository.getYearGraph()

    await repository.appendTransaction({
      type: 'expense',
      date: '2025-12-15',
      amount: 32000,
      description: 'Previous year edit',
      account: 'Checking',
      category: 'Food',
    })

    expect(fakeSheetsClient.appendCalls[0]?.spreadsheetId).toBe('sheet-2025')

    const unmarkedRootHarness = createHarness({
      workbooks: [createLedgerWorkbook({
        spreadsheetId: 'sheet-2026',
        year: 2026,
        environment: '',
      })],
    })
    await unmarkedRootHarness.repository.getYearGraph()

    await unmarkedRootHarness.repository.appendTransaction({
      type: 'expense',
      date: '2026-08-18',
      amount: 1000,
      description: 'Unmarked root write',
      account: 'Checking',
      category: 'Food',
    })
    expect(unmarkedRootHarness.fakeSheetsClient.appendCalls).toHaveLength(1)
  })

  it('links a newly verified year and updates neighboring app settings', async () => {
    const { repository, fakeSheetsClient } = createHarness()

    const linkedYears = await repository.linkYear({
      year: 2027,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-2027/edit',
    })

    expect(linkedYears.map((item) => item.year)).toEqual([2025, 2026, 2027])
    expect(fakeSheetsClient.updateCalls).toEqual([
      {
        spreadsheetId: 'sheet-2027',
        range: buildRange('앱설정', 'A:B'),
        values: fakeSheetsClient.getSheetValues('sheet-2027', '앱설정'),
      },
      {
        spreadsheetId: 'sheet-2026',
        range: buildRange('앱설정', 'A:B'),
        values: fakeSheetsClient.getSheetValues('sheet-2026', '앱설정'),
      },
    ])
  })

  it('links a workbook regardless of its environment label', async () => {
    const workbooks = createDefaultWorkbooks().map((workbook) =>
      workbook.spreadsheetId === 'sheet-2027'
        ? { ...workbook, environment: 'PRODUCTION' }
        : workbook,
    )
    const { repository, fakeSheetsClient } = createHarness({ workbooks })

    await repository.linkYear({
      year: 2027,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-2027/edit',
    })
    expect(fakeSheetsClient.updateCalls).toHaveLength(2)
  })

  it('writes to a pre-linked workbook regardless of its environment label', async () => {
    const workbooks = createDefaultWorkbooks().map((workbook) =>
      workbook.spreadsheetId === 'sheet-2025'
        ? { ...workbook, environment: '' }
        : workbook,
    )
    const { repository, fakeSheetsClient } = createHarness({ workbooks })

    await repository.getYearGraph()
    await repository.appendTransaction({
      type: 'expense',
      date: '2025-12-15',
      amount: 32000,
      description: 'Previous year edit',
      account: 'Checking',
      category: 'Food',
    })
    expect(fakeSheetsClient.appendCalls).toHaveLength(1)

    await repository.updateTransaction(
      {
        year: 2025,
        month: 1,
        sourceRow: 2,
        legacyFingerprint: {
          date: '2025-01-03',
          amount: -4500,
          description: 'Previous year row',
          account: 'Checking',
          category: 'Food',
        },
      },
      {
        type: 'expense',
        date: '2025-01-03',
        amount: 5000,
        description: 'Previous year edit',
        account: 'Checking',
        category: 'Food',
      },
    )
    expect(fakeSheetsClient.updateCalls).not.toHaveLength(0)
  })

  it('links adjacent years regardless of neighboring environment labels', async () => {
    const workbooks = [
      ...createDefaultWorkbooks().map((workbook) =>
        workbook.spreadsheetId === 'sheet-2025'
          ? { ...workbook, environment: 'PRODUCTION' }
          : workbook,
      ),
      createLedgerWorkbook({ spreadsheetId: 'sheet-2024', year: 2024 }),
    ]
    const { repository, fakeSheetsClient } = createHarness({ workbooks })

    await repository.linkYear({
      year: 2024,
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-2024/edit',
    })
    expect(fakeSheetsClient.updateCalls).toHaveLength(2)
    expect(
      fakeSheetsClient.getSheetValues('sheet-2024', '앱설정')
        .find((row) => row[0] === 'nextSpreadsheetId')?.[1],
    ).toBe('sheet-2025')
  })

  it('copies previous december and its budget remainder into current month zero without reverse writes', async () => {
    const { repository, fakeSheetsClient } = createHarness()

    await repository.syncMonthZero(2026)

    const monthZeroRows = fakeSheetsClient.getSheetValues('sheet-2026', '0')
    expect(monthZeroRows[0]?.slice(0, 26)).toEqual(new Array<string>(26).fill(''))
    expect(monthZeroRows[1]?.slice(0, 5)).toEqual([
      '2025-12-31',
      '990000',
      'Carry over',
      'Savings',
      'Carry',
    ])
    expect(monthZeroRows[1]?.[23]).toBe('income')
    expect(monthZeroRows[1]?.[24]).toBe('txn_prev_december')
    expect(monthZeroRows[0]?.slice(27, 29)).toEqual(['통장', '연도시작잔액'])
    expect(monthZeroRows[1]?.slice(27, 29)).toEqual(['Checking', '-4500'])
    expect(monthZeroRows[2]?.slice(27, 29)).toEqual(['Savings', '990000'])
    const monthZeroBudget = fakeSheetsClient.getSheetValues('sheet-2026', '예산월별')
      .find((row) => row[0] === '0' && row[1] === 'Living')
    expect(monthZeroBudget).toEqual(['0', 'Living', '12995500', '0'])
    expect(fakeSheetsClient.batchUpdateValuesCalls).toHaveLength(1)
    expect(fakeSheetsClient.batchUpdateValuesCalls[0]).toMatchObject({
      spreadsheetId: 'sheet-2026',
    })
    expect(fakeSheetsClient.batchUpdateValuesCalls[0]?.data[0]?.range).toBe(
      buildRange('0', 'A1:Z2'),
    )
    expect(fakeSheetsClient.updateCalls).toHaveLength(0)

    const januarySettlement = await repository.getSettlement(2026, 1)
    expect(januarySettlement.accounts).toMatchObject([
      {
        account: 'Checking',
        previousMonthBalance: -4500,
        currentMonthBalance: -26500,
      },
      {
        account: 'Savings',
        previousMonthBalance: 990000,
        currentMonthBalance: 990000,
      },
    ])
  })

  it('returns graceful warnings when optional investment and energy sheets cannot be read', async () => {
    const { repository, fakeSheetsClient } = createHarness()
    fakeSheetsClient.failRange(
      'sheet-2026',
      buildRange('투자', 'A:Z'),
      new AppError('GOOGLE_API_ERROR', '투자 시트를 읽을 수 없습니다.'),
    )
    fakeSheetsClient.failRange(
      'sheet-2026',
      buildRange('에너지', 'A:Z'),
      new AppError('GOOGLE_API_ERROR', '에너지 시트를 읽을 수 없습니다.'),
    )

    const [investment, energy] = await Promise.all([
      repository.getInvestmentSummary(2026, 8),
      repository.getEnergySummary(2026, 8),
    ])

    expect(investment).toEqual({
      year: 2026,
      month: 8,
      metrics: [],
      allocation: [],
      warnings: ['투자 시트를 읽을 수 없습니다.'],
    })
    expect(energy).toEqual({
      year: 2026,
      month: 8,
      metrics: [],
      warnings: ['에너지 시트를 읽을 수 없습니다.'],
    })
  })
})
