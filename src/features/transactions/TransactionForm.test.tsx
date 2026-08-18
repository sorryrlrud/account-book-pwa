import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TransactionForm } from './TransactionForm.tsx'
import type {
  TransactionFormState,
  TransactionFormSubmitPayload,
} from './types.ts'

function renderForm(
  overrides: Partial<React.ComponentProps<typeof TransactionForm>> = {},
) {
  const onSubmit = vi.fn<
    (payload: TransactionFormSubmitPayload) => Promise<void>
  >().mockResolvedValue(undefined)

  const view = render(
    <TransactionForm
      title="거래 입력"
      accounts={['Checking', 'Savings']}
      categories={['Food', 'Bills']}
      isBusy={false}
      submitLabel="저장"
      errorMessage=""
      statusMessage=""
      onSubmit={onSubmit}
      {...overrides}
    />,
  )

  return { onSubmit, ...view }
}

describe('TransactionForm', () => {
  it('changes the form color theme with the selected transaction type', async () => {
    const user = userEvent.setup()
    const { container } = renderForm()
    const form = container.querySelector('form')

    expect(form).toHaveClass('transaction-form--expense')
    await user.click(screen.getByRole('tab', { name: '수입' }))
    expect(form).toHaveClass('transaction-form--income')
    await user.click(screen.getByRole('tab', { name: '이체' }))
    expect(form).toHaveClass('transaction-form--transfer')
  })

  it('retains inactive account and category values while editing an existing transaction', () => {
    const { container } = renderForm({
      accounts: ['Active account'],
      categories: ['Active category'],
      initialTransaction: {
        id: 'legacy-row',
        type: 'expense',
        date: '2026-08-08',
        amount: -48_000,
        description: 'Legacy charge',
        account: 'Inactive account',
        category: 'Inactive category',
        sourceYear: 2026,
        sourceMonth: 8,
      },
    })

    const [accountSelect, categorySelect] = container.querySelectorAll('select')
    expect(accountSelect).toHaveValue('Inactive account')
    expect(categorySelect).toHaveValue('Inactive category')
    expect(screen.getByRole('option', { name: 'Inactive account (사용중지)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Inactive category (사용중지)' })).toBeInTheDocument()
  })

  it('requires an explicit type choice before saving an unknown legacy transaction', async () => {
    const user = userEvent.setup()
    renderForm({
      initialTransaction: {
        type: 'unknown',
        date: '2026-08-08',
        amount: 48_000,
        description: 'Unclassified legacy row',
        account: 'Checking',
        sourceYear: 2026,
        sourceMonth: 8,
      },
    })

    expect(screen.getByText(/유형을 판단할 수 없습니다/)).toBeVisible()
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
    expect(screen.getByRole('tab', { name: '지출' })).toHaveAttribute('aria-selected', 'false')

    await user.click(screen.getByRole('tab', { name: '수입' }))
    expect(screen.getByRole('tab', { name: '수입' })).toHaveAttribute('aria-selected', 'true')
  })

  it('formats the amount with thousands separators and allows an empty category', async () => {
    const user = userEvent.setup()
    const { onSubmit, container } = renderForm()

    const saveButton = screen.getByRole('button', { name: '저장' })
    const amountInput = container.querySelector('input[inputmode="numeric"]') as HTMLInputElement
    const descriptionInput = container.querySelector('input[placeholder="예: 점심 식사"]') as HTMLInputElement
    expect(saveButton).toBeDisabled()

    await user.type(amountInput, '15000')
    expect(amountInput).toHaveValue('15,000')
    await user.type(descriptionInput, '점심 식사')
    expect(saveButton).not.toBeDisabled()
    await user.click(saveButton)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      transaction: undefined,
      draft: {
        type: 'expense',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        amount: 15000,
        description: '점심 식사',
        account: 'Checking',
        category: undefined,
        destinationAccount: undefined,
      },
      resetState: {
        type: 'expense',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        amountInput: '',
        description: '',
        account: 'Checking',
        category: '',
        destinationAccount: 'Savings',
      },
    })
  })

  it('applies the parent resetState after save and preserves date and account', async () => {
    const user = userEvent.setup()
    const observedPayloads: TransactionFormSubmitPayload[] = []

    function Harness() {
      const [resetState, setResetState] = React.useState<TransactionFormState | null>(null)

      return (
        <TransactionForm
          title="거래 입력"
          accounts={['Checking', 'Savings']}
          categories={['Food', 'Bills']}
          isBusy={false}
          submitLabel="저장"
          errorMessage=""
          statusMessage=""
          resetState={resetState}
          onSubmit={async (payload) => {
            observedPayloads.push(payload)
            setResetState(payload.resetState)
          }}
        />
      )
    }

    const { container } = render(<Harness />)

    const saveButton = screen.getByRole('button', { name: '저장' })
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement
    const amountInput = container.querySelector('input[inputmode="numeric"]') as HTMLInputElement
    const descriptionInput = container.querySelector('input[placeholder="예: 점심 식사"]') as HTMLInputElement
    const accountSelect = container.querySelectorAll('select')[0] as HTMLSelectElement
    const categorySelect = container.querySelectorAll('select')[1] as HTMLSelectElement

    await user.clear(dateInput)
    await user.type(dateInput, '2026-08-10')
    await user.type(amountInput, '41000')
    await user.type(descriptionInput, '마트 장보기')
    await user.selectOptions(accountSelect, 'Savings')
    await user.selectOptions(categorySelect, 'Bills')
    await user.click(saveButton)

    await waitFor(() => {
      expect(observedPayloads).toHaveLength(1)
    })

    expect(observedPayloads[0]?.resetState).toEqual({
      type: 'expense',
      date: '2026-08-10',
      amountInput: '',
      description: '',
      account: 'Savings',
      category: '',
      destinationAccount: 'Savings',
    })

    await waitFor(() => {
      expect(amountInput.value).toBe('')
      expect(descriptionInput.value).toBe('')
      expect(categorySelect.value).toBe('')
      expect(dateInput.value).toBe('2026-08-10')
      expect(accountSelect.value).toBe('Savings')
    })
  })
})
