import { MonthNavigator } from '@/features/readViews/components/MonthNavigator'
import { SummaryCard } from '@/features/readViews/components/SummaryCard'
import { BudgetGroupCard } from '@/features/budgets/components/BudgetGroupCard'
import type {
  BudgetAdjustmentConfirmation,
  BudgetAdjustmentDraft,
  BudgetGroupView,
} from '@/features/budgets/types'
import { formatMonthLabel } from '@/features/readViews/formatters'

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
  isBusy?: boolean
  canWrite?: boolean
  monthNotice?: string
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
    <div className="confirmation-overlay">
      <section
        className={`panel confirmation-dialog budget-page__confirmation${confirmation.tone === 'danger' ? ' is-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-confirmation-title"
      >
        <h3 id="budget-confirmation-title">
          {confirmation.title}
        </h3>
        <p>{confirmation.description}</p>
        <div className="confirmation-actions">
          <button
            type="button"
            className={confirmation.tone === 'danger' ? 'primary-button primary-button--danger' : 'primary-button'}
            onClick={confirmation.onConfirm}
            disabled={confirmation.busy}
          >
            {confirmation.busy ? '처리 중...' : confirmation.confirmLabel}
          </button>
          <button type="button" className="secondary-button" onClick={confirmation.onCancel} disabled={confirmation.busy} autoFocus>
            {confirmation.cancelLabel ?? '취소'}
          </button>
        </div>
      </section>
    </div>
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
  isBusy = false,
  canWrite = true,
  monthNotice,
  onPreviousMonth,
  onNextMonth,
  onSelectGroup,
  onAdjustmentDraftChange,
  onSubmitAdjustment,
  onRequestResetCarryOver,
}: BudgetPageProps) {
  const selectedGroup =
    groups.find((group) => group.group.name === selectedGroupName) ?? groups[0]
  const parsedAdjustment = Number(adjustmentDraft.amount.replaceAll(',', ''))
  const adjustmentChanged = Boolean(
    selectedGroup &&
    adjustmentDraft.amount.trim() &&
    Number.isFinite(parsedAdjustment) &&
    parsedAdjustment !== selectedGroup.monthly.adjustment,
  )

  return (
    <section className="read-page budget-page">
      <header className="read-page__header budget-page__header">
        <div>
          <p className="read-page__eyebrow budget-page__eyebrow">
            예산 관리
          </p>
          <h2 className="read-page__title budget-page__title">
            {formatMonthLabel(year, month)} 예산
          </h2>
        </div>
        <MonthNavigator
          year={year}
          month={month}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onPrevious={onPreviousMonth}
          onNext={onNextMonth}
          notice={monthNotice}
        />
      </header>

      <section className="budget-page__groups" aria-label="예산 그룹 목록">
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
          <div className="budget-page__editor">
            <p className="budget-page__selected-group">
              선택 그룹: <strong>{selectedGroup.group.name}</strong>
            </p>
            <label className="field budget-page__field">
              <span>이번 달 수동조정</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="예: -300000"
                value={adjustmentDraft.amount}
                onChange={(event) =>
                  onAdjustmentDraftChange({
                    ...adjustmentDraft,
                    amount: event.target.value,
                  })
                }
                className="budget-page__input budget-page__input--amount"
                disabled={isBusy || !canWrite}
              />
            </label>
            <p className="budget-page__field-help">
              현재 저장된 수동조정 금액을 새 값으로 교체합니다. 조정을 없애려면 0을 입력하세요.
            </p>
            {adjustmentError ? (
              <p className="form-error budget-page__error" role="alert">
                {adjustmentError}
              </p>
            ) : null}
            {!canWrite ? (
              <p className="form-status">Google 로그인과 Sheet 접근 확인이 완료되면 예산을 변경할 수 있습니다.</p>
            ) : null}
            <div className="budget-page__actions">
              <button type="button" className="primary-button" onClick={onSubmitAdjustment} disabled={isBusy || !canWrite || !adjustmentChanged}>
                조정 적용 확인
              </button>
              <button
                type="button"
                onClick={() => onRequestResetCarryOver(selectedGroup.group.name)}
                className="secondary-button"
                disabled={isBusy || !canWrite || selectedGroup.monthly.carryOver === 0}
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
