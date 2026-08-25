import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  AppServiceContext,
  defaultAppService,
  type AppService,
} from '@/app/app-service-core.ts'
import { EntryPage } from '@/pages/EntryPage.tsx'

function renderEntry(saveTransaction: AppService['saveTransaction']) {
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
      accounts: ['Checking', 'Savings'],
      categories: ['Food'],
    }),
    getSettingsData: vi.fn().mockResolvedValue({
      year: 2026,
      yearConfig: {
        spreadsheetId: 'sheet-2026',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-2026/edit',
        year: 2026,
        schemaVersion: 1,
        budgetStartMonth: 1,
      },
      linkedYears: [],
      accounts: [],
      categories: [],
      budgetGroups: [],
    }),
    getBudgets: vi.fn().mockResolvedValue([]),
    getSettlement: vi.fn().mockResolvedValue({
      year: 2026,
      month: 8,
      income: 0,
      expense: 0,
      accounts: [
        { account: 'Checking', previousMonthBalance: 1_000_000, currentMonthBalance: 900_000, delta: -100_000 },
        { account: 'Savings', previousMonthBalance: 2_000_000, currentMonthBalance: 2_100_000, delta: 100_000 },
      ],
    }),
    saveTransaction,
  }

  return render(
    <AppServiceContext.Provider value={service}>
      <EntryPage />
    </AppServiceContext.Provider>,
  )
}

describe('EntryPage', () => {
  it('uses the main save button for a safe retry without showing a retry panel', async () => {
    const user = userEvent.setup()
    const saveTransaction = vi.fn<AppService['saveTransaction']>()
      .mockRejectedValueOnce(new Error('일시적인 저장 오류'))
      .mockResolvedValueOnce({
        transaction: {
          id: 'txn_stablerequest',
          type: 'expense',
          date: '2026-08-11',
          amount: -15_000,
          description: 'Lunch',
          account: 'Checking',
          category: 'Food',
          sourceYear: 2026,
          sourceMonth: 8,
          sourceRow: 2,
        },
      })
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-1111-1111-111111111111',
    )

    const { container } = renderEntry(saveTransaction)
    const amountInput = container.querySelector('input[inputmode="numeric"]') as HTMLInputElement
    const descriptionInput = container.querySelector('input[placeholder="예: 점심 식사"]') as HTMLInputElement

    await screen.findByRole('option', { name: 'Food' })
    await user.type(amountInput, '15000')
    await user.type(descriptionInput, 'Lunch')
    await user.selectOptions(screen.getByRole('combobox', { name: '카테고리' }), 'Food')
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(await screen.findByText('일시적인 저장 오류')).toBeVisible()
    expect(screen.queryByRole('heading', { name: '재시도' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(saveTransaction).toHaveBeenCalledTimes(2))

    expect(saveTransaction.mock.calls[0]?.[0].clientRequestId).toBe(
      '11111111-1111-1111-1111-111111111111',
    )
    expect(saveTransaction.mock.calls[1]?.[0].clientRequestId).toBe(
      '11111111-1111-1111-1111-111111111111',
    )
    expect(await screen.findByText('저장이 완료되었습니다.')).toBeVisible()
  })
})
