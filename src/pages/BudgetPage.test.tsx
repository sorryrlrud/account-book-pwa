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
  it('shows a loading message instead of the empty state while loading', () => {
    render(
      <BudgetPage
        year={2026}
        month={8}
        groups={[]}
        adjustmentDraft={{ groupName: '', amount: '' }}
        isBusy
        onPreviousMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onAdjustmentDraftChange={vi.fn()}
        onSubmitAdjustment={vi.fn()}
        onRequestResetCarryOver={vi.fn()}
      />,
    )

    expect(screen.getByText('불러오는 중입니다.')).toBeVisible()
    expect(screen.queryByText('표시할 예산 그룹이 없습니다.')).not.toBeInTheDocument()
  })

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
    expect(screen.queryByText('상세 및 조정')).not.toBeInTheDocument()

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
    expect(screen.getByText('상세 및 조정')).toBeVisible()
    expect(screen.getByLabelText('이번 달 수동조정')).toHaveValue('0')
    expect(screen.queryByRole('button', { name: '기준예산 변경 확인' })).not.toBeInTheDocument()
    expect(screen.queryByText(/저장된 수동조정 금액/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이월 금액 초기화' })).toBeVisible()
  })

  it('fills the bar by the remaining ratio and combines usage amounts below it', () => {
    const { container } = render(
      <BudgetPage
        year={2026}
        month={8}
        groups={[GROUP]}
        adjustmentDraft={{ groupName: '', amount: '' }}
        onPreviousMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onAdjustmentDraftChange={vi.fn()}
        onSubmitAdjustment={vi.fn()}
        onRequestResetCarryOver={vi.fn()}
      />,
    )

    expect(container.querySelector('.budget-group-card__progress-value')).toHaveStyle({
      width: '60%',
    })
    expect(screen.getByText('60% 남음 (660,000 / 1,100,000원)')).toBeVisible()
    expect(screen.queryByText('전체')).not.toBeInTheDocument()
  })

  it('shows a full remaining bar when none of the available budget was used', () => {
    const unusedGroup: BudgetGroupView = {
      ...GROUP,
      monthly: {
        ...GROUP.monthly,
        spent: 0,
        remaining: 1_100_000,
      },
    }
    const { container } = render(
      <BudgetPage
        year={2026}
        month={8}
        groups={[unusedGroup]}
        adjustmentDraft={{ groupName: '', amount: '' }}
        onPreviousMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onAdjustmentDraftChange={vi.fn()}
        onSubmitAdjustment={vi.fn()}
        onRequestResetCarryOver={vi.fn()}
      />,
    )

    expect(container.querySelector('.budget-group-card__progress-value')).toHaveStyle({
      width: '100%',
    })
    expect(screen.getByText('100% 남음 (1,100,000 / 1,100,000원)')).toBeVisible()
  })

  it('accepts a one-time delta even when a different adjustment total is already stored', () => {
    const adjustedGroup: BudgetGroupView = {
      ...GROUP,
      monthly: {
        ...GROUP.monthly,
        adjustment: 50_000,
        effectiveBudget: 1_150_000,
        remaining: 710_000,
      },
    }
    render(
      <BudgetPage
        year={2026}
        month={8}
        groups={[adjustedGroup]}
        selectedGroupName="생활비"
        adjustmentDraft={{ groupName: '생활비', amount: '100000' }}
        onPreviousMonth={vi.fn()}
        onNextMonth={vi.fn()}
        onAdjustmentDraftChange={vi.fn()}
        onSubmitAdjustment={vi.fn()}
        onRequestResetCarryOver={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '조정 적용 확인' })).toBeEnabled()
  })
})
