import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BudgetGroupView } from '@/features/budgets/types.ts'
import BudgetPage from '@/pages/BudgetPage.tsx'

const GROUP: BudgetGroupView = {
  group: {
    name: '생활비',
    baseMonthlyBudget: 1_000_000,
    active: true,
    order: 1,
  },
  monthly: {
    year: 2026,
    month: 8,
    groupName: '생활비',
    baseSnapshot: 1_000_000,
    carryOver: 100_000,
    adjustment: 0,
    effectiveBudget: 1_100_000,
    spent: 440_000,
    remaining: 660_000,
    nextMonthExpected: 1_660_000,
  },
  details: [
    { label: '기준 월예산', amount: 1_000_000 },
    { label: '전월 이월', amount: 100_000 },
    { label: '이번 달 조정', amount: 0 },
  ],
}

describe('BudgetPage', () => {
  it('keeps each budget compact until its card is selected', async () => {
    const user = userEvent.setup()
    const onSelectGroup = vi.fn()
    const props = {
      year: 2026,
      month: 8,
      groups: [GROUP],
      adjustmentDraft: { groupName: '', amount: '' },
      onPreviousMonth: vi.fn(),
      onNextMonth: vi.fn(),
      onSelectGroup,
      onAdjustmentDraftChange: vi.fn(),
      onSubmitAdjustment: vi.fn(),
      onRequestResetCarryOver: vi.fn(),
    }

    const { rerender } = render(<BudgetPage {...props} />)

    expect(screen.getByRole('button', { name: /생활비/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('상세 및 편집 · 조정')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /생활비/ }))
    expect(onSelectGroup).toHaveBeenCalledWith('생활비')

    rerender(
      <BudgetPage
        {...props}
        selectedGroupName="생활비"
        adjustmentDraft={{ groupName: '생활비', amount: '0' }}
      />,
    )

    expect(screen.getByRole('button', { name: /생활비/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('상세 및 편집 · 조정')).toBeVisible()
    expect(screen.getByRole('button', { name: '이월 금액 초기화' })).toBeVisible()
  })
})
