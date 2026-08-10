import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppService, useReferenceData } from '@/app/use-app-service.ts'
import { formatDateHeading } from '@/features/transactions/date.ts'
import { formatKrw } from '@/features/transactions/format.ts'
import { TransactionForm } from '@/features/transactions/TransactionForm.tsx'
import type { Transaction } from '@/domain/transaction.ts'
import { isAppError } from '@/domain/errors.ts'
import { getYearMonthFromDate } from '@/utils/date.ts'
import type {
  TransactionFormState,
  TransactionFormSubmitPayload,
} from '@/features/transactions/types.ts'

export function EntryPage() {
  const service = useAppService()
  const { accounts, categories } = useReferenceData()
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [retryPayload, setRetryPayload] = useState<TransactionFormSubmitPayload | null>(
    null,
  )
  const [recentSaved, setRecentSaved] = useState<Transaction | null>(null)
  const [formResetState, setFormResetState] = useState<TransactionFormState | null>(null)
  const [formPreview, setFormPreview] = useState<TransactionFormState | null>(null)
  const [budgetContext, setBudgetContext] = useState<{
    groupName: string
    remaining: number
  } | null>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    let active = true
    if (
      !service.auth.canRead ||
      !formPreview?.category ||
      formPreview.type !== 'expense' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(formPreview.date)
    ) {
      setBudgetContext(null)
      return () => { active = false }
    }

    const { year, month } = getYearMonthFromDate(formPreview.date)
    void Promise.all([
      service.getSettingsData(year),
      service.getBudgets(year, month),
    ]).then(([settings, budgets]) => {
      if (!active) return
      const groupName = settings.categories.find(
        (category) => category.name === formPreview.category,
      )?.budgetGroup
      const budget = budgets.find((item) => item.groupName === groupName)
      setBudgetContext(
        groupName && budget
          ? { groupName, remaining: budget.remaining }
          : null,
      )
    }).catch(() => {
      if (active) setBudgetContext(null)
    })

    return () => { active = false }
  }, [
    formPreview?.category,
    formPreview?.date,
    formPreview?.type,
    service,
    service.auth.canRead,
  ])

  const handleFormStateChange = useCallback((state: TransactionFormState) => {
    setFormPreview(state)
  }, [])

  const budgetHint = (() => {
    if (!budgetContext) return ''
    const amount = Number(formPreview?.amountInput ?? 0)
    const remainingAfterSave = budgetContext.remaining - (Number.isFinite(amount) ? amount : 0)
    if (amount > 0) {
      return remainingAfterSave >= 0
        ? `${budgetContext.groupName} · 저장 후 ${formatKrw(remainingAfterSave)} 남음`
        : `${budgetContext.groupName} · ${formatKrw(Math.abs(remainingAfterSave))} 초과`
    }
    return budgetContext.remaining >= 0
      ? `${budgetContext.groupName} · ${formatKrw(budgetContext.remaining)} 남음`
      : `${budgetContext.groupName} · ${formatKrw(Math.abs(budgetContext.remaining))} 초과`
  })()

  const saveEntry = async (payload: TransactionFormSubmitPayload) => {
    if (savingRef.current || !service.hasWriteAccess) {
      return
    }

    const requestPayload: TransactionFormSubmitPayload = payload.draft.clientRequestId
      ? payload
      : {
          ...payload,
          draft: {
            ...payload.draft,
            clientRequestId: crypto.randomUUID(),
          },
        }
    savingRef.current = true
    setIsSaving(true)
    setErrorMessage('')
    setStatusMessage('저장 요청을 보내는 중입니다.')
    setRetryPayload(requestPayload)

    try {
      const result = await service.saveTransaction(requestPayload.draft)
      setRecentSaved(result.transaction)
      setFormResetState(payload.resetState)
      setRetryPayload(null)
      setStatusMessage('저장이 완료되었습니다.')
    } catch (error) {
      setStatusMessage('')
      if (isAppError(error) && error.code === 'TRANSFER_INTEGRITY') {
        setRetryPayload(null)
      }
      setErrorMessage(
        error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.',
      )
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <section className="page">
      <div className="page-intro">
        <h2>입력</h2>
        <p>지출·수입·이체를 빠르게 Google Sheet에 기록합니다.</p>
      </div>

      <TransactionForm
        title="거래 입력"
        accounts={accounts}
        categories={categories}
        isBusy={isSaving}
        isWriteEnabled={service.hasWriteAccess}
        submitLabel="저장"
        errorMessage={errorMessage}
        statusMessage={statusMessage}
        budgetHint={budgetHint}
        resetState={formResetState}
        onStateChange={handleFormStateChange}
        onSubmit={saveEntry}
      />

      {retryPayload ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>재시도</h2>
              <p className="panel__description">마지막 저장 요청을 다시 보낼 수 있습니다.</p>
            </div>
          </div>
          <button
            type="button"
            className="secondary-button secondary-button--full"
            disabled={isSaving}
            onClick={() => {
              void saveEntry(retryPayload)
            }}
          >
            {isSaving ? '처리 중...' : '마지막 요청 다시 저장'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>최근 저장 항목</h2>
            <p className="panel__description">
              {formResetState
                ? '성공 후 날짜와 계좌는 유지하고 금액·내용은 비웁니다.'
                : '아직 성공적으로 저장된 항목이 없습니다.'}
            </p>
          </div>
        </div>
        {recentSaved ? (
          <article className="history-item">
            <div>
              <strong>{recentSaved.description}</strong>
              <p>
            {formatDateHeading(recentSaved.date)} · {recentSaved.account}
              </p>
            </div>
            <strong>
              {formatKrw(
                recentSaved.type === 'transfer'
                  ? Math.abs(recentSaved.amount)
                  : recentSaved.amount,
              )}
            </strong>
          </article>
        ) : (
          <p className="empty-state">
            {service.hasWriteAccess
              ? '아직 성공적으로 저장된 거래가 없습니다.'
              : 'TEST Spreadsheet ID가 확인되면 저장 기능이 활성화됩니다.'}
          </p>
        )}
      </section>
    </section>
  )
}
