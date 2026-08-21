import { useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { BudgetGroupCard } from '@/features/budgets/components/BudgetGroupCard'
import type {
  BudgetConfirmation,
  BudgetEditorDraft,
  BudgetGroupView,
} from '@/features/budgets/types'
import { formatCurrency, formatMonthLabel } from '@/features/readViews/formatters'
import { MonthNavigator } from '@/features/readViews/components/MonthNavigator'

export interface BudgetPageProps {
  year: number
  month: number
  budgetStartMonth?: number
  canGoPrevious?: boolean
  canGoNext?: boolean
  groups: BudgetGroupView[]
  selectedGroupName?: string
  isEditing?: boolean
  editorDraft: BudgetEditorDraft
  saveConfirmation?: BudgetConfirmation
  isBusy?: boolean
  canWrite?: boolean
  monthNotice?: string
  onPreviousMonth: () => void
  onNextMonth: () => void
  onSelectGroup?: (groupName: string) => void
  onStartEditing: () => void
  onCancelEditing: () => void
  onEditorDraftChange: (draft: BudgetEditorDraft) => void
  onRequestSave: () => void
}

function renderConfirmation(confirmation?: BudgetConfirmation) {
  if (!confirmation?.open) return null

  return (
    <div className="confirmation-overlay">
      <section
        className={`panel confirmation-dialog budget-page__confirmation${confirmation.tone === 'danger' ? ' is-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-confirmation-title"
      >
        <h3 id="budget-confirmation-title">{confirmation.title}</h3>
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
          <button
            type="button"
            className="secondary-button"
            onClick={confirmation.onCancel}
            disabled={confirmation.busy}
            autoFocus
          >
            {confirmation.cancelLabel ?? '취소'}
          </button>
        </div>
      </section>
    </div>
  )
}

function parseAmount(value: string): number | undefined {
  if (!value.trim()) return undefined
  const amount = Number(value.replaceAll(',', ''))
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined
}

function formatAmountInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, '')
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

export default function BudgetPage({
  year,
  month,
  budgetStartMonth = 1,
  canGoPrevious = true,
  canGoNext = true,
  groups,
  selectedGroupName,
  isEditing = false,
  editorDraft,
  saveConfirmation,
  isBusy = false,
  canWrite = true,
  monthNotice,
  onPreviousMonth,
  onNextMonth,
  onSelectGroup,
  onStartEditing,
  onCancelEditing,
  onEditorDraftChange,
  onRequestSave,
}: BudgetPageProps) {
  const [newGroupName, setNewGroupName] = useState('')
  const [addError, setAddError] = useState('')
  const [draggingGroupName, setDraggingGroupName] = useState('')
  const longPressTimer = useRef<number | undefined>(undefined)
  const dragGroupName = useRef('')
  const selectedGroup = groups.find((group) => group.group.name === selectedGroupName)
  const isBeforeBudgetStart = month < budgetStartMonth
  const totalBudget = groups.reduce((sum, group) => sum + group.monthly.effectiveBudget, 0)
  const totalRemaining = groups.reduce((sum, group) => sum + group.monthly.remaining, 0)
  const parsedMaximum = parseAmount(editorDraft.maximumBudget)
  const allocatedBudget = editorDraft.groups.reduce((sum, group) => sum + group.allocatedBudget, 0)
  const unallocatedBudget = (parsedMaximum ?? 0) - allocatedBudget
  const draftGroupNames = new Set(editorDraft.groups.map((group) => group.name))
  const carryOverBudget = groups.reduce(
    (sum, group) => sum + (draftGroupNames.has(group.group.name) ? group.monthly.carryOver : 0),
    0,
  )
  const budgetExceeded = parsedMaximum !== undefined && allocatedBudget > parsedMaximum
  const saveDisabled = isBusy || !canWrite || parsedMaximum === undefined || budgetExceeded

  const updateGroupAmount = (name: string, amount: number) => {
    onEditorDraftChange({
      ...editorDraft,
      groups: editorDraft.groups.map((group) =>
        group.name === name
          ? { ...group, allocatedBudget: Math.max(0, Math.round(amount / 10_000) * 10_000) }
          : group,
      ),
    })
  }

  const clearLongPress = () => {
    if (longPressTimer.current !== undefined) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = undefined
    }
  }

  const endDrag = () => {
    clearLongPress()
    dragGroupName.current = ''
    setDraggingGroupName('')
  }

  const startLongPress = (event: ReactPointerEvent<HTMLButtonElement>, groupName: string) => {
    if (event.button !== 0) return
    clearLongPress()
    event.currentTarget.setPointerCapture(event.pointerId)
    longPressTimer.current = window.setTimeout(() => {
      dragGroupName.current = groupName
      setDraggingGroupName(groupName)
    }, 320)
  }

  const moveDraggedGroup = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const activeGroupName = dragGroupName.current
    if (!activeGroupName) return
    event.preventDefault()
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-budget-editor-index]')
    const targetIndex = Number(target?.dataset.budgetEditorIndex)
    reorderGroup(activeGroupName, targetIndex)
  }

  const reorderGroup = (activeGroupName: string, targetIndex: number) => {
    const currentIndex = editorDraft.groups.findIndex((group) => group.name === activeGroupName)
    if (!Number.isInteger(targetIndex) || currentIndex < 0 || targetIndex === currentIndex) return

    const nextGroups = [...editorDraft.groups]
    const [moved] = nextGroups.splice(currentIndex, 1)
    if (!moved) return
    nextGroups.splice(targetIndex, 0, moved)
    onEditorDraftChange({ ...editorDraft, groups: nextGroups })
  }

  const enterDraggedGroup = (event: ReactDragEvent<HTMLElement>, targetIndex: number) => {
    event.preventDefault()
    if (dragGroupName.current) reorderGroup(dragGroupName.current, targetIndex)
  }

  const addGroup = () => {
    const name = newGroupName.trim()
    if (!name) {
      setAddError('새 카테고리 이름을 입력해주세요.')
      return
    }
    if (editorDraft.groups.some((group) => group.name === name)) {
      setAddError('같은 이름의 카테고리가 이미 있습니다.')
      return
    }
    onEditorDraftChange({
      ...editorDraft,
      groups: [...editorDraft.groups, { name, allocatedBudget: 0, isNew: true }],
    })
    setNewGroupName('')
    setAddError('')
  }

  return (
    <section className={`read-page budget-page${isEditing ? ' is-editing' : ''}`}>
      <header className="read-page__header budget-page__header">
        <div className="budget-page__title-row">
          <div>
            <p className="read-page__eyebrow budget-page__eyebrow">예산 관리</p>
            <h2 className="read-page__title budget-page__title">
              {formatMonthLabel(year, month)} 예산
            </h2>
          </div>
          <div className="budget-page__mode-actions">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="text-button budget-page__cancel-button"
                  onClick={onCancelEditing}
                  disabled={isBusy}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="primary-button budget-page__save-button"
                  onClick={onRequestSave}
                  disabled={saveDisabled}
                >
                  {isBusy ? '저장 중' : '저장'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="secondary-button budget-page__edit-button"
                onClick={onStartEditing}
                disabled={isBusy || !canWrite || isBeforeBudgetStart}
              >
                편집
              </button>
            )}
          </div>
        </div>
        {isEditing && unallocatedBudget > 0 ? (
          <p className="budget-page__save-hint">
            미할당 예산 {formatCurrency(unallocatedBudget)}이 남아 있어요. 그대로 저장할 수 있습니다.
          </p>
        ) : null}
        <MonthNavigator
          year={year}
          month={month}
          canGoPrevious={canGoPrevious && !isEditing}
          canGoNext={canGoNext && !isEditing}
          onPrevious={onPreviousMonth}
          onNext={onNextMonth}
          notice={monthNotice}
        />
      </header>

      {isEditing ? (
        <section className={`panel budget-page__plan${budgetExceeded ? ' is-over-limit' : ''}`} aria-labelledby="budget-plan-title">
          <div className="budget-page__plan-heading">
            <div>
              <p className="budget-page__section-kicker">이월 제외</p>
              <h3 id="budget-plan-title">최대 예산</h3>
            </div>
            <label className="budget-page__maximum-field">
              <span className="sr-only">최대 예산</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={editorDraft.maximumBudget}
                onChange={(event) => onEditorDraftChange({
                  ...editorDraft,
                  maximumBudget: formatAmountInput(event.target.value),
                })}
                disabled={isBusy || !canWrite}
              />
              <span aria-hidden="true">원</span>
            </label>
          </div>
          <div className="budget-page__allocation-summary">
            <span>할당된 예산</span>
            <strong>
              {formatCurrency(allocatedBudget)}
              <small> / {formatCurrency(parsedMaximum ?? 0)}</small>
            </strong>
          </div>
          <div className="budget-page__allocation-track" aria-hidden="true">
            <span style={{ width: `${parsedMaximum && parsedMaximum > 0 ? Math.min(100, (allocatedBudget / parsedMaximum) * 100) : 0}%` }} />
          </div>
          <p className="budget-page__carry-over-summary">이월된 예산 {formatCurrency(carryOverBudget)}</p>
          {budgetExceeded ? (
            <p className="form-error" role="alert">
              할당된 예산이 최대 예산보다 {formatCurrency(Math.abs(unallocatedBudget))} 많습니다. 카테고리 예산을 줄여주세요.
            </p>
          ) : null}
          {!canWrite ? (
            <p className="form-status">Google 로그인과 Sheet 접근 확인이 완료되면 예산을 변경할 수 있습니다.</p>
          ) : null}
        </section>
      ) : isBeforeBudgetStart ? (
        <section className="panel budget-page__totals" aria-labelledby="budget-start-title">
          <h3 id="budget-start-title" className="budget-page__totals-title">예산 관리 시작 전</h3>
          <p className="form-status">
            {year}년 예산은 {budgetStartMonth}월부터 계산하며, 이전 달의 예산과 거래는 이월하지 않습니다.
          </p>
        </section>
      ) : (
        <section className="panel budget-page__totals" aria-labelledby="budget-totals-title">
          <h3 id="budget-totals-title" className="budget-page__totals-title">이달 예산 계</h3>
          <div className="budget-page__total-grid">
            <div className="budget-page__total budget-page__total--budget">
              <span>총 사용 가능액</span>
              <strong>{formatCurrency(totalBudget)}</strong>
            </div>
            <div className={`budget-page__total budget-page__total--remaining${totalRemaining < 0 ? ' is-negative' : ''}`}>
              <span>남은 예산</span>
              <strong>{formatCurrency(totalRemaining)}</strong>
            </div>
          </div>
        </section>
      )}

      {isEditing ? (
        <section className="budget-page__editor-groups" aria-labelledby="budget-editor-groups-title">
          <div className="budget-page__editor-heading">
            <div>
              <h3 id="budget-editor-groups-title">카테고리 할당</h3>
              <p>슬라이더는 5만원, −/+ 버튼은 1만원 단위로 조절됩니다.</p>
            </div>
            <span>{editorDraft.groups.length}개</span>
          </div>
          <div className="budget-page__editor-list">
            {editorDraft.groups.map((group, index) => {
              const availableIncrease = Math.max(0, unallocatedBudget)
              const sliderMaximum = Math.max(group.allocatedBudget, group.allocatedBudget + availableIncrease)
              const sliderMinimum = group.allocatedBudget % 50_000
              return (
                <article
                  key={group.name}
                  className={`budget-editor-card${draggingGroupName === group.name ? ' is-dragging' : ''}`}
                  data-budget-editor-index={index}
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={(event) => enterDraggedGroup(event, index)}
                >
                  <div className="budget-editor-card__heading">
                    <button
                      type="button"
                      className="budget-editor-card__drag-handle"
                      draggable
                      aria-label={`${group.name} 길게 눌러 순서 변경`}
                      title="길게 눌러 순서 변경"
                      onPointerDown={(event) => startLongPress(event, group.name)}
                      onPointerMove={moveDraggedGroup}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onLostPointerCapture={endDrag}
                      onDragStart={() => {
                        dragGroupName.current = group.name
                        setDraggingGroupName(group.name)
                      }}
                      onDragEnd={endDrag}
                    >
                      <span aria-hidden="true">⠿</span>
                    </button>
                    <div>
                      <h4>{group.name}</h4>
                      {group.isNew ? <span className="budget-editor-card__new">새 카테고리</span> : null}
                    </div>
                    <strong>{formatCurrency(group.allocatedBudget)}</strong>
                    <button
                      type="button"
                      className="budget-editor-card__remove"
                      aria-label={`${group.name} 제거`}
                      onClick={() => onEditorDraftChange({
                        ...editorDraft,
                        groups: editorDraft.groups.filter((item) => item.name !== group.name),
                      })}
                      disabled={isBusy || !canWrite}
                    >
                      제거
                    </button>
                  </div>
                  <div className="budget-editor-card__controls">
                    <input
                      type="range"
                      min={sliderMinimum}
                      max={Math.max(0, sliderMaximum)}
                      step="50000"
                      value={Math.min(group.allocatedBudget, sliderMaximum)}
                      aria-label={`${group.name} 할당 예산`}
                      onChange={(event) => updateGroupAmount(group.name, Number(event.target.value))}
                      disabled={isBusy || !canWrite || sliderMaximum === 0}
                    />
                    <div className="budget-editor-card__fine-controls" aria-label={`${group.name} 미세 조정`}>
                      <button
                        type="button"
                        aria-label={`${group.name} 1만원 줄이기`}
                        onClick={() => updateGroupAmount(group.name, group.allocatedBudget - 10_000)}
                        disabled={isBusy || !canWrite || group.allocatedBudget < 10_000}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        aria-label={`${group.name} 1만원 늘리기`}
                        onClick={() => updateGroupAmount(group.name, group.allocatedBudget + 10_000)}
                        disabled={isBusy || !canWrite || availableIncrease < 10_000}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          <form
            className="panel budget-page__add-category"
            onSubmit={(event) => {
              event.preventDefault()
              addGroup()
            }}
          >
            <div>
              <h3>새 카테고리</h3>
              <p>추가 후 위에서 예산을 할당하세요.</p>
            </div>
            <div className="budget-page__add-row">
              <label className="field">
                <span className="sr-only">새 카테고리 이름</span>
                <input
                  type="text"
                  value={newGroupName}
                  placeholder="예: 여행"
                  onChange={(event) => {
                    setNewGroupName(event.target.value)
                    setAddError('')
                  }}
                  disabled={isBusy || !canWrite}
                />
              </label>
              <button type="submit" className="secondary-button" disabled={isBusy || !canWrite}>추가</button>
            </div>
            {addError ? <p className="form-error" role="alert">{addError}</p> : null}
          </form>
        </section>
      ) : (
        <section className="budget-page__groups" aria-label="예산 그룹 목록">
          {groups.length ? groups.map((group) => (
            <BudgetGroupCard
              key={group.group.name}
              item={group}
              expanded={group.group.name === selectedGroup?.group.name}
              onSelect={onSelectGroup}
            />
          )) : (
            <p className="budget-page__empty" role="status">
              {isBusy
                ? '불러오는 중입니다.'
                : isBeforeBudgetStart
                  ? `${budgetStartMonth}월부터 예산을 계산합니다.`
                  : '표시할 예산 그룹이 없습니다.'}
            </p>
          )}
        </section>
      )}

      {renderConfirmation(saveConfirmation)}
    </section>
  )
}
