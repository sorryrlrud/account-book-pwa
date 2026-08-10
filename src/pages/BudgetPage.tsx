import { MonthNavigator } from '@/features/readViews/components/MonthNavigator'
import { SummaryCard } from '@/features/readViews/components/SummaryCard'
import { BudgetGroupCard } from '@/features/budgets/components/BudgetGroupCard'
import type {
  BudgetAdjustmentConfirmation,
  BudgetAdjustmentDraft,
  BudgetGroupView,
} from '@/features/budgets/types'
import { CONTROL_STYLE, formatMonthLabel } from '@/features/readViews/formatters'

export interface BudgetPageProps {
  year: number
  month: number
  canGoPrevious?: boolean
  canGoNext?: boolean
  groups: BudgetGroupView[]
  selectedGroupName?: string
  adjustmentDraft: BudgetAdjustmentDraft
  adjustmentError?: string
  adjustmentConfirmation?: BudgetAdjustmentConfirmation
  resetConfirmation?: BudgetAdjustmentConfirmation
  onPreviousMonth: () => void
  onNextMonth: () => void
  onSelectGroup?: (groupName: string) => void
  onAdjustmentDraftChange: (draft: BudgetAdjustmentDraft) => void
  onSubmitAdjustment: () => void
  onRequestResetCarryOver: (groupName: string) => void
}

function renderConfirmation(confirmation?: BudgetAdjustmentConfirmation) {
  if (!confirmation?.open) {
    return null
  }

  return (
    <section
      className="budget-page__confirmation"
      role="dialog"
      aria-labelledby="budget-confirmation-title"
      style={{ border: '1px solid currentColor', borderRadius: '16px', padding: '16px' }}
    >
      <h2 id="budget-confirmation-title" style={{ marginTop: 0 }}>
        {confirmation.title}
      </h2>
      <p>{confirmation.description}</p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={confirmation.onConfirm} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
          {confirmation.confirmLabel}
        </button>
        <button type="button" onClick={confirmation.onCancel} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
          {confirmation.cancelLabel ?? '취소'}
        </button>
      </div>
    </section>
  )
}

export default function BudgetPage({
  year,
  month,
  canGoPrevious = true,
  canGoNext = true,
  groups,
  selectedGroupName,
  adjustmentDraft,
  adjustmentError,
  adjustmentConfirmation,
  resetConfirmation,
  onPreviousMonth,
  onNextMonth,
  onSelectGroup,
  onAdjustmentDraftChange,
  onSubmitAdjustment,
  onRequestResetCarryOver,
}: BudgetPageProps) {
  const selectedGroup =
    groups.find((group) => group.group.name === selectedGroupName) ?? groups[0]

  return (
    <section className="budget-page" style={{ display: 'grid', gap: '16px' }}>
      <header className="budget-page__header" style={{ display: 'grid', gap: '12px' }}>
        <div>
          <p className="budget-page__eyebrow" style={{ margin: 0 }}>
            예산 관리
          </p>
          <h1 className="budget-page__title" style={{ margin: '8px 0 0' }}>
            {formatMonthLabel(year, month)} 예산
          </h1>
        </div>
        <MonthNavigator
          year={year}
          month={month}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onPrevious={onPreviousMonth}
          onNext={onNextMonth}
        />
      </header>

      <section className="budget-page__groups" aria-label="예산 그룹 목록" style={{ display: 'grid', gap: '12px' }}>
        {groups.map((group) => (
          <BudgetGroupCard
            key={group.group.name}
            item={group}
            selected={group.group.name === selectedGroup?.group.name}
            onSelect={onSelectGroup}
          />
        ))}
      </section>

      <SummaryCard
        title="조정 및 이월 초기화"
        description="선택한 그룹에 조정 금액을 반영하거나 현재 이월 금액을 0으로 초기화할 수 있습니다."
      >
        {selectedGroup ? (
          <div className="budget-page__editor" style={{ display: 'grid', gap: '12px' }}>
            <p className="budget-page__selected-group" style={{ margin: 0 }}>
              선택 그룹: <strong>{selectedGroup.group.name}</strong>
            </p>
            <label className="budget-page__field" style={{ display: 'grid', gap: '6px' }}>
              <span>조정 대상 그룹</span>
              <input
                type="text"
                value={adjustmentDraft.groupName}
                onChange={(event) =>
                  onAdjustmentDraftChange({
                    ...adjustmentDraft,
                    groupName: event.target.value,
                  })
                }
                className="budget-page__input budget-page__input--group"
                style={CONTROL_STYLE}
              />
            </label>
            <label className="budget-page__field" style={{ display: 'grid', gap: '6px' }}>
              <span>조정 금액</span>
              <input
                type="text"
                inputMode="numeric"
                value={adjustmentDraft.amount}
                onChange={(event) =>
                  onAdjustmentDraftChange({
                    ...adjustmentDraft,
                    amount: event.target.value,
                  })
                }
                className="budget-page__input budget-page__input--amount"
                style={CONTROL_STYLE}
              />
            </label>
            <label className="budget-page__field" style={{ display: 'grid', gap: '6px' }}>
              <span>사유</span>
              <textarea
                value={adjustmentDraft.reason}
                onChange={(event) =>
                  onAdjustmentDraftChange({
                    ...adjustmentDraft,
                    reason: event.target.value,
                  })
                }
                className="budget-page__textarea"
                style={{ minHeight: '88px' }}
              />
            </label>
            {adjustmentError ? (
              <p className="budget-page__error" role="alert" style={{ margin: 0, color: '#b91c1c' }}>
                {adjustmentError}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button type="button" onClick={onSubmitAdjustment} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
                조정 적용 확인
              </button>
              <button
                type="button"
                onClick={() => onRequestResetCarryOver(selectedGroup.group.name)}
                style={{ ...CONTROL_STYLE, minWidth: '120px' }}
              >
                이월 금액 초기화
              </button>
            </div>
          </div>
        ) : (
          <p className="budget-page__empty" role="status">
            표시할 예산 그룹이 없습니다.
          </p>
        )}
      </SummaryCard>

      {renderConfirmation(adjustmentConfirmation)}
      {renderConfirmation(resetConfirmation)}
    </section>
  )
}
