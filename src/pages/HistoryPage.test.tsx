import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AppServiceContext, defaultAppService, type AppService } from '@/app/app-service-core.ts'
import { HistoryPage } from '@/pages/HistoryPage.tsx'

function renderHistory(overrides: Partial<AppService> = {}) {
  const listTransactions = vi.fn<AppService['listTransactions']>().mockResolvedValue([
    {
      id: 'expense-1',
      type: 'expense',
      date: '2026-08-10',
      amount: -12_500,
      description: '점심 식사',
      account: '생활비 카드',
      category: '식비',
      sourceYear: 2026,
      sourceMonth: 8,
      sourceRow: 2,
    },
    {
      id: 'income-1',
      type: 'income',
      date: '2026-08-10',
      amount: 3_000_000,
      description: '월급',
      account: '생활비 카드',
      category: '급여',
      sourceYear: 2026,
      sourceMonth: 8,
      sourceRow: 3,
    },
    {
      id: 'uncategorized-expense',
      type: 'expense',
      date: '2026-08-10',
      amount: -50_000,
      description: '카테고리 없는 지출',
      account: '생활비 카드',
      sourceYear: 2026,
      sourceMonth: 8,
      sourceRow: 4,
    },
    {
      id: 'transfer-1',
      transferId: 'transfer-pair-1',
      type: 'transfer',
      date: '2026-08-10',
      amount: -1_000_000,
      description: '저축 이체',
      account: '생활비 카드',
      destinationAccount: '저축 통장',
      sourceYear: 2026,
      sourceMonth: 8,
      sourceRow: 5,
    },
  ])
  const service: AppService = {
    ...defaultAppService,
    isConfigured: true,
    statusLabel: '연결됨',
    auth: {
      status: 'ready',
      message: '연결됨',
      isBusy: false,
      isAuthenticated: true,
      canRead: true,
      canWrite: true,
      requiresLogin: false,
    },
    currentYear: 2026,
    currentMonth: 8,
    hasWriteAccess: true,
    getReferenceData: vi.fn().mockResolvedValue({
      accounts: ['생활비 카드'],
      categories: ['식비'],
    }),
    getYearGraph: vi.fn().mockResolvedValue({
      bootstrapSpreadsheetId: 'sheet-2026',
      years: new Map([[2026, {
        spreadsheetId: 'sheet-2026',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-2026/edit',
        year: 2026,
        schemaVersion: 1,
        budgetStartMonth: 1,
      }]]),
    }),
    listTransactions,
    getAccountBalances: vi.fn().mockResolvedValue([
      { account: '생활비 카드', balance: 737_500 },
      { account: '저축 통장', balance: 5_000_000 },
    ]),
    ...overrides,
  }

  render(
    <AppServiceContext.Provider value={service}>
      <HistoryPage />
    </AppServiceContext.Provider>,
  )

  return { listTransactions }
}

describe('HistoryPage', () => {
  it('shows category statistics before filters and monthly details', async () => {
    renderHistory()

    const statistics = await screen.findByRole('heading', { name: '카테고리 통계' })
    const balances = screen.getByRole('heading', { name: '통장별 잔액' })
    const filters = screen.getByRole('heading', { name: '필터링 및 검색' })
    const details = screen.getByRole('heading', { name: '월별 내역' })

    expect(screen.getByText(/₩12,500 · 100%/)).toBeVisible()
    expect(within(statistics.closest('section')!).queryByText('미분류')).not.toBeInTheDocument()
    expect(balances.compareDocumentPosition(statistics) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(balances.closest('section')!).getByText('₩737,500')).toBeVisible()
    expect(within(balances.closest('section')!).getByText('₩5,000,000')).toBeVisible()
    expect(statistics.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(filters.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('switches category statistics between expenses and incomes', async () => {
    const user = userEvent.setup()
    renderHistory()

    expect(await screen.findByText('월 지출 합계 ₩12,500')).toBeVisible()
    expect(screen.getByText('₩12,500 · 100%')).toBeVisible()

    await user.click(screen.getByRole('tab', { name: '수입' }))

    expect(screen.getByText('월 수입 합계 ₩3,000,000')).toBeVisible()
    expect(screen.getByText('₩3,000,000 · 100%')).toBeVisible()
    expect(screen.getByRole('tab', { name: '수입' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows totals by account across non-transfer transaction types', async () => {
    const user = userEvent.setup()
    renderHistory()

    await user.click(await screen.findByRole('tab', { name: '통장(카드)' }))

    expect(screen.getByText('월 통장(카드) 거래 합계 ₩3,062,500')).toBeVisible()
    expect(screen.getByText('₩3,062,500 · 100%')).toBeVisible()
  })

  it('expands the editor directly below the selected transaction', async () => {
    const user = userEvent.setup()
    renderHistory()

    const transactionButton = await screen.findByRole('button', { name: /점심 식사/ })
    await user.click(transactionButton)

    expect(transactionButton).toHaveAttribute('aria-expanded', 'true')
    const table = transactionButton.closest<HTMLTableElement>('table')!
    expect(within(table).getByRole('heading', { name: '거래 수정' })).toBeVisible()
    expect(within(table).getByRole('button', { name: '거래 삭제' })).toBeVisible()
  })

  it('combines month navigation with the title and keeps refresh as an icon button', async () => {
    const user = userEvent.setup()
    const { listTransactions } = renderHistory()

    expect(await screen.findByRole('heading', { name: '2026년 8월' })).toBeVisible()
    expect(screen.queryByText('현재 월 기준으로 내역을 조회합니다.')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('조회 월')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '새로고침' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: '다음 달' }))

    expect(await screen.findByRole('heading', { name: '2026년 9월' })).toBeVisible()
    await waitFor(() => expect(listTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ month: '2026-09' }),
    ))
  })

  it('renders each date as one compact transaction table', async () => {
    renderHistory()

    const dateHeading = await screen.findByRole('heading', { name: /8월 10일/ })
    const dateSection = dateHeading.closest('section')!
    const table = within(dateSection).getByRole('table')

    expect(within(table).getAllByRole('row')).toHaveLength(5)
    expect(within(table).getByRole('columnheader', { name: '내용' })).toBeInTheDocument()
    expect(within(table).getByText('점심 식사')).toBeVisible()
    expect(within(table).getByText('-₩12,500')).toBeVisible()
  })

  it('toggles account balances as the linked account filter', async () => {
    const user = userEvent.setup()
    renderHistory()
    const accountFilter = await screen.findByRole('combobox', { name: '계좌' })
    const savingsBalance = screen.getByRole('button', { name: /저축 통장.*₩5,000,000/ })

    await user.click(savingsBalance)

    expect(accountFilter).toHaveValue('저축 통장')
    expect(screen.getByText('저축 이체')).toBeVisible()
    expect(screen.queryByText('점심 식사')).not.toBeInTheDocument()
    expect(savingsBalance).toHaveAttribute('aria-pressed', 'true')

    await user.click(savingsBalance)

    expect(accountFilter).toHaveValue('')
    expect(await screen.findByText('점심 식사')).toBeVisible()
  })

  it('toggles category statistics and combines them with the account filter', async () => {
    const user = userEvent.setup()
    renderHistory()
    const categoryFilter = await screen.findByRole('combobox', { name: '분류' })
    const accountFilter = screen.getByRole('combobox', { name: '계좌' })
    const foodStatistic = screen.getByRole('button', { name: /식비.*₩12,500/ })

    await user.click(foodStatistic)
    expect(categoryFilter).toHaveValue('식비')
    expect(screen.getByText('점심 식사')).toBeVisible()
    expect(screen.queryByText('월급')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /저축 통장.*₩5,000,000/ }))
    expect(categoryFilter).toHaveValue('식비')
    expect(accountFilter).toHaveValue('저축 통장')
    expect(screen.getByText('조건에 맞는 거래가 없습니다.')).toBeVisible()

    await user.click(foodStatistic)
    expect(categoryFilter).toHaveValue('')
    expect(accountFilter).toHaveValue('저축 통장')
    expect(await screen.findByText('저축 이체')).toBeVisible()
  })

  it('filters the loaded month locally without another Sheets request', async () => {
    const user = userEvent.setup()
    const { listTransactions } = renderHistory()

    await screen.findByRole('button', { name: /점심 식사/ })
    expect(listTransactions).toHaveBeenCalledTimes(1)

    await user.type(screen.getByRole('textbox', { name: '검색' }), '점심')
    await user.selectOptions(screen.getByRole('combobox', { name: '유형' }), 'expense')

    await waitFor(() => expect(screen.getByRole('button', { name: /점심 식사/ })).toBeVisible())
    expect(listTransactions).toHaveBeenCalledTimes(1)
  })
})
