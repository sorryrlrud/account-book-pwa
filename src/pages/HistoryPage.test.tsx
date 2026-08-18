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
      }]]),
    }),
    listTransactions,
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
    const filters = screen.getByRole('heading', { name: '필터링 및 검색' })
    const details = screen.getByRole('heading', { name: '월별 내역' })

    expect(screen.getByText(/₩12,500 · 100%/)).toBeVisible()
    expect(within(statistics.closest('section')!).queryByText('미분류')).not.toBeInTheDocument()
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
