import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BudgetGroupView } from '@/features/budgets/types.ts'
import BudgetPage, { type BudgetPageProps } from '@/pages/BudgetPage.tsx'

const GROUP: BudgetGroupView = {
  group: {
    name: '생활비',
    baseMonthlyBudget: 1_000_000,
    startMonth: 1,
    active: true,
    order: 1,
  },
  monthly: {
    year: 2026,
    month: 8,
    groupName: '생활비',
    baseSnapshot: 1_000_000,
    allocatedBudget: 1_000_000,
    carryOver: 100_000,
    adjustment: 0,
    effectiveBudget: 1_100_000,
    spent: 440_000,
    remaining: 660_000,
    nextMonthExpected: 1_660_000,
  },
  details: [
    { label: '할당 예산', amount: 1_000_000 },
    { label: '전월 정산 반영', amount: 100_000, signed: true },
    { label: '사용액', amount: 440_000 },
  ],
}

function createProps(overrides: Partial<BudgetPageProps> = {}): BudgetPageProps {
  return {
    year: 2026,
    month: 8,
    groups: [GROUP],
    editorDraft: {
      maximumBudget: '1,000,000',
      groups: [{ name: '생활비', allocatedBudget: 1_000_000 }],
    },
    settlementDraft: {
      groups: [{ name: '생활비', currentRemaining: 660_000, carryOver: '660,000' }],
    },
    onPreviousMonth: vi.fn(),
    onNextMonth: vi.fn(),
    onStartEditing: vi.fn(),
    onStartSettlement: vi.fn(),
    onCancelEditing: vi.fn(),
    onCancelSettlement: vi.fn(),
    onEditorDraftChange: vi.fn(),
    onSettlementDraftChange: vi.fn(),
    onRequestSave: vi.fn(),
    onRequestSettlement: vi.fn(),
    ...overrides,
  }
}

describe('BudgetPage', () => {
  it('keeps the read view compact and exposes editing from the title', async () => {
    const user = userEvent.setup()
    const onStartEditing = vi.fn()
    const onSelectGroup = vi.fn()
    const props = createProps({ onStartEditing, onSelectGroup })
    const { rerender } = render(<BudgetPage {...props} />)

    const totals = screen.getByRole('heading', { name: '이달 예산 계' }).closest('section')!
    expect(within(totals).getByText('총 사용 가능액')).toBeVisible()
    expect(within(totals).getByText('1,100,000원')).toBeVisible()
    expect(within(totals).getByText('남은 예산')).toBeVisible()
    expect(within(totals).getByText('660,000원')).toBeVisible()

    await user.click(screen.getByRole('button', { name: '편집' }))
    expect(onStartEditing).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: /생활비/ }))
    expect(onSelectGroup).toHaveBeenCalledWith('생활비')
    rerender(<BudgetPage {...props} selectedGroupName="생활비" />)

    expect(screen.getByText('할당 예산')).toBeVisible()
    expect(screen.getByText('전월 정산 반영')).toBeVisible()
    expect(screen.getByText('다음 달 정산 반영')).toBeVisible()
    expect(screen.queryByText('상세 및 조정')).not.toBeInTheDocument()
    expect(screen.queryByText('이번 달 수동조정')).not.toBeInTheDocument()
  })

  it('formats the maximum, uses a 50000 slider step, and fine-tunes by 10000', async () => {
    const user = userEvent.setup()
    const onEditorDraftChange = vi.fn()
    render(<BudgetPage {...createProps({ isEditing: true, onEditorDraftChange })} />)

    const maximumInput = screen.getByRole('textbox', { name: '최대 예산' })
    expect(maximumInput).toHaveValue('1,000,000')
    await user.clear(maximumInput)
    await user.type(maximumInput, '2000000')
    expect(onEditorDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
      maximumBudget: expect.stringMatching(/[0-9,]+/),
    }))

    const slider = screen.getByRole('slider', { name: '생활비 할당 예산' })
    expect(slider).toHaveAttribute('step', '50000')
    fireEvent.change(slider, { target: { value: '950000' } })
    expect(onEditorDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      groups: [expect.objectContaining({ allocatedBudget: 950_000 })],
    }))

    await user.click(screen.getByRole('button', { name: '생활비 1만원 줄이기' }))
    expect(onEditorDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      groups: [expect.objectContaining({ allocatedBudget: 990_000 })],
    }))
  })

  it('disables saving when allocations exceed the maximum', () => {
    render(<BudgetPage {...createProps({
      isEditing: true,
      editorDraft: {
        maximumBudget: '900,000',
        groups: [{ name: '생활비', allocatedBudget: 1_000_000 }],
      },
    })} />)

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('100,000원 많습니다')
  })

  it('allows saving with an unallocated remainder and explains it below the title action', () => {
    render(<BudgetPage {...createProps({
      isEditing: true,
      editorDraft: {
        maximumBudget: '1,200,000',
        groups: [{ name: '생활비', allocatedBudget: 1_000_000 }],
      },
    })} />)

    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled()
    expect(screen.getByText(/미할당 예산 200,000원/)).toBeVisible()
  })

  it('adds and removes budget categories in the draft', async () => {
    const user = userEvent.setup()
    const onEditorDraftChange = vi.fn()
    render(<BudgetPage {...createProps({ isEditing: true, onEditorDraftChange })} />)

    await user.type(screen.getByRole('textbox', { name: '새 카테고리 이름' }), '여행')
    await user.click(screen.getByRole('button', { name: '추가' }))
    expect(onEditorDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      groups: expect.arrayContaining([
        expect.objectContaining({ name: '여행', allocatedBudget: 0, isNew: true }),
      ]),
    }))

    await user.click(screen.getByRole('button', { name: '생활비 제거' }))
    expect(onEditorDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({ groups: [] }))
  })

  it('reorders categories from the drag handle', () => {
    const onEditorDraftChange = vi.fn()
    render(<BudgetPage {...createProps({
      isEditing: true,
      onEditorDraftChange,
      editorDraft: {
        maximumBudget: '1,500,000',
        groups: [
          { name: '생활비', allocatedBudget: 1_000_000 },
          { name: '반려동물', allocatedBudget: 500_000 },
        ],
      },
    })} />)

    fireEvent.dragStart(screen.getByRole('button', { name: '생활비 길게 눌러 순서 변경' }))
    fireEvent.dragEnter(screen.getByRole('heading', { name: '반려동물' }).closest('article')!)

    expect(onEditorDraftChange).toHaveBeenCalledWith(expect.objectContaining({
      groups: [
        expect.objectContaining({ name: '반려동물' }),
        expect.objectContaining({ name: '생활비' }),
      ],
    }))
  })

  it('shows loading instead of the empty state while data is loading', () => {
    render(<BudgetPage {...createProps({ groups: [], isBusy: true })} />)

    expect(screen.getByText('불러오는 중입니다.')).toBeVisible()
    expect(screen.queryByText('표시할 예산 그룹이 없습니다.')).not.toBeInTheDocument()
  })

  it('explains and disables editing before the configured budget start month', () => {
    render(<BudgetPage {...createProps({
      month: 7,
      budgetStartMonth: 8,
      groups: [],
    })} />)

    expect(screen.getByRole('heading', { name: '예산 관리 시작 전' })).toBeVisible()
    expect(screen.getByText(/8월부터 계산하며/)).toBeVisible()
    expect(screen.getByRole('button', { name: '편집' })).toBeDisabled()
  })

  it('shows settlement beside edit and renders a current-month warning dialog', async () => {
    const user = userEvent.setup()
    const onStartSettlement = vi.fn()
    const onConfirm = vi.fn()
    render(<BudgetPage {...createProps({
      onStartSettlement,
      settlementWarning: {
        open: true,
        title: '아직 정산할 수 없어요',
        description: '현재 월이 끝난 뒤 정산할 수 있습니다.',
        confirmLabel: '확인',
        confirmOnly: true,
        onConfirm,
        onCancel: vi.fn(),
      },
    })} />)

    await user.click(screen.getByRole('button', { name: '정산' }))
    expect(onStartSettlement).toHaveBeenCalledOnce()
    expect(screen.getByRole('dialog')).toHaveTextContent('현재 월이 끝난 뒤')
    expect(screen.queryByRole('button', { name: '취소' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('allows signed category amounts while keeping a positive total fixed', () => {
    const onSettlementDraftChange = vi.fn()
    const { rerender } = render(<BudgetPage {...createProps({
      isSettling: true,
      onSettlementDraftChange,
    })} />)

    expect(screen.getByRole('button', { name: '정산 완료' })).toBeEnabled()
    const amountInput = screen.getByRole('textbox', { name: '생활비 정산 이월액' })
    fireEvent.change(amountInput, { target: { value: '-10000' } })
    expect(onSettlementDraftChange).toHaveBeenLastCalledWith({
      groups: [expect.objectContaining({ carryOver: '-10,000' })],
    })

    const otherGroup: BudgetGroupView = {
      ...GROUP,
      group: { ...GROUP.group, name: '반려동물', order: 2 },
      monthly: {
        ...GROUP.monthly,
        groupName: '반려동물',
        effectiveBudget: 500_000,
        spent: 400_000,
        remaining: 100_000,
      },
    }
    rerender(<BudgetPage {...createProps({
      groups: [GROUP, otherGroup],
      isSettling: true,
      settlementDraft: {
        groups: [
          { name: '생활비', currentRemaining: 660_000, carryOver: '-40,000' },
          { name: '반려동물', currentRemaining: 100_000, carryOver: '800,000' },
        ],
      },
    })} />)
    expect(screen.getByRole('button', { name: '정산 완료' })).toBeEnabled()

    rerender(<BudgetPage {...createProps({
      isSettling: true,
      settlementDraft: {
        groups: [{ name: '생활비', currentRemaining: 660_000, carryOver: '-10,000' }],
      },
    })} />)
    expect(screen.getByRole('button', { name: '정산 완료' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('배분 합계')
  })

  it('allows an overall deficit to be written off to zero by category', () => {
    const deficitGroup: BudgetGroupView = {
      ...GROUP,
      monthly: {
        ...GROUP.monthly,
        spent: 1_300_000,
        remaining: -200_000,
      },
    }
    render(<BudgetPage {...createProps({
      groups: [deficitGroup],
      isSettling: true,
      settlementDraft: {
        groups: [{ name: '생활비', currentRemaining: -200_000, carryOver: '0' }],
      },
    })} />)

    expect(screen.getByRole('button', { name: '정산 완료' })).toBeEnabled()
    expect(screen.getByText(/0원까지 손실 처리/)).toBeVisible()
  })
})
