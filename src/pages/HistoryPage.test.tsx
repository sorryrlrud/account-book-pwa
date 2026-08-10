import { render, screen, waitFor } from '@testing-library/react'
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
