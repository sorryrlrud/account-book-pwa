import { MonthNavigator } from '@/features/readViews/components/MonthNavigator'
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
  baseBudgetDraft?: string
  adjustmentError?: string
  adjustmentConfirmation?: BudgetAdjustmentConfirmation
  resetConfirmation?: BudgetAdjustmentConfirmation
  baseBudgetConfirmation?: BudgetAdjustmentConfirmation
  isBusy?: boolean
  canWrite?: boolean
  monthNotice?: string
  onPreviousMonth: () => void
  onNextMonth: () => void
  onSelectGroup?: (groupName: string) => void
  onAdjustmentDraftChange: (draft: BudgetAdjustmentDraft) => void
  onBaseBudgetDraftChange?: (amount: string) => void
  onSubmitBaseBudget?: () => void
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
  baseBudgetDraft = '',
  adjustmentError,
  adjustmentConfirmation,
  resetConfirmation,
  baseBudgetConfirmation,
  isBusy = false,
  canWrite = true,
  monthNotice,
  onPreviousMonth,
  onNextMonth,
  onSelectGroup,
  onAdjustmentDraftChange,
  onBaseBudgetDraftChange,
  onSubmitBaseBudget,
  onSubmitAdjustment,
  onRequestResetCarryOver,
}: BudgetPageProps) {
  const selectedGroup = groups.find((group) => group.group.name === selectedGroupName)
  const parsedAdjustment = Number(adjustmentDraft.amount.replaceAll(',', ''))
  const adjustmentChanged = Boolean(
    selectedGroup &&
    adjustmentDraft.amount.trim() &&
    Number.isFinite(parsedAdjustment) &&
    parsedAdjustment !== selectedGroup.monthly.adjustment,
  )
  const parsedBaseBudget = Number(baseBudgetDraft.replaceAll(',', ''))
  const baseBudgetChanged = Boolean(
    selectedGroup &&
    baseBudgetDraft.trim() &&
    Number.isFinite(parsedBaseBudget) &&
    parsedBaseBudget >= 0 &&
    parsedBaseBudget !== selectedGroup.group.baseMonthlyBudget,
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
        {groups.length ? groups.map((group) => {
          const expanded = group.group.name === selectedGroup?.group.name
          return (
            <BudgetGroupCard
              key={group.group.name}
              item={group}
              expanded={expanded}
              onSelect={onSelectGroup}
            >
              {expanded ? (
                <div className="budget-page__editor">
                  <h4 className="budget-page__editor-title">상세 및 편집 · 조정</h4>
                  <label className="field budget-page__field">
                    <span>기준 월예산</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="예: 1500000"
                      value={baseBudgetDraft}
                      onChange={(event) => onBaseBudgetDraftChange?.(event.target.value)}
                      className="budget-page__input budget-page__input--amount"
                      disabled={isBusy || !canWrite || !onBaseBudgetDraftChange}
                    />
                  </label>
                  <p className="budget-page__field-help">
                    이후 새로 생성되는 월별 예산의 기준값입니다. 이미 저장된 월별 스냅샷은 유지됩니다.
                  </p>
                  <div className="budget-page__actions">
                    <button type="button" className="secondary-button" onClick={onSubmitBaseBudget} disabled={isBusy || !canWrite || !baseBudgetChanged}>
                      기준예산 변경 확인
                    </button>
                  </div>
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
                    저장된 수동조정 금액을 새 값으로 교체합니다. 조정을 없애려면 0을 입력하세요.
                  </p>
                  {adjustmentError ? (
                    <p className="form-error budget-page__error" role="alert">{adjustmentError}</p>
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
                      onClick={() => onRequestResetCarryOver(group.group.name)}
                      className="secondary-button"
                      disabled={isBusy || !canWrite || group.monthly.carryOver === 0}
                    >
                      이월 금액 초기화
                    </button>
                  </div>
                </div>
              ) : null}
            </BudgetGroupCard>
          )
        }) : (
          <p className="budget-page__empty" role="status">
            {isBusy ? '불러오는 중입니다.' : '표시할 예산 그룹이 없습니다.'}
          </p>
        )}
      </section>

      {renderConfirmation(adjustmentConfirmation)}
      {renderConfirmation(resetConfirmation)}
      {renderConfirmation(baseBudgetConfirmation)}
    </section>
  )
}
