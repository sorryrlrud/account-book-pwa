import { MonthNavigator } from '@/features/readViews/components/MonthNavigator'
import { BudgetGroupCard } from '@/features/budgets/components/BudgetGroupCard'
import type {
  BudgetAdjustmentConfirmation,
  BudgetAdjustmentDraft,
  BudgetGroupView,
} from '@/features/budgets/types'
import { formatMonthLabel } from '@/features/readViews/formatters'
import { formatCurrency } from '@/features/readViews/formatters'

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
  const selectedGroup = groups.find((group) => group.group.name === selectedGroupName)
  const parsedAdjustment = Number(adjustmentDraft.amount.replaceAll(',', ''))
  const adjustmentChanged = Boolean(
    selectedGroup &&
    adjustmentDraft.amount.trim() &&
    Number.isFinite(parsedAdjustment) &&
    parsedAdjustment !== 0,
  )
  const totalBudget = groups.reduce((sum, group) => sum + group.monthly.effectiveBudget, 0)
  const totalRemaining = groups.reduce((sum, group) => sum + group.monthly.remaining, 0)

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

      <section className="panel budget-page__totals" aria-labelledby="budget-totals-title">
        <h3 id="budget-totals-title" className="budget-page__totals-title">이달 예산 계</h3>
        <div className="budget-page__total-grid">
          <div className="budget-page__total budget-page__total--budget">
            <span>총 예산</span>
            <strong>{formatCurrency(totalBudget)}</strong>
          </div>
          <div className={`budget-page__total budget-page__total--remaining${totalRemaining < 0 ? ' is-negative' : ''}`}>
            <span>남은 예산</span>
            <strong>{formatCurrency(totalRemaining)}</strong>
          </div>
        </div>
      </section>

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
                  <h4 className="budget-page__editor-title">상세 및 조정</h4>
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
    </section>
  )
}
