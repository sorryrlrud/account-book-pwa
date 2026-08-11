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

function isSameDraft(
  left: TransactionFormSubmitPayload['draft'],
  right: TransactionFormSubmitPayload['draft'],
) {
  return (
    left.type === right.type &&
    left.date === right.date &&
    left.amount === right.amount &&
    left.description === right.description &&
    left.account === right.account &&
    left.category === right.category &&
    left.destinationAccount === right.destinationAccount
  )
}

export function EntryPage() {
  const service = useAppService()
  const { accounts, categories } = useReferenceData()
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [recentSaved, setRecentSaved] = useState<Transaction | null>(null)
  const [formResetState, setFormResetState] = useState<TransactionFormState | null>(null)
  const [formPreview, setFormPreview] = useState<TransactionFormState | null>(null)
  const [budgetContext, setBudgetContext] = useState<{
    groupName: string
    remaining: number
  } | null>(null)
  const savingRef = useRef(false)
  const failedRequestRef = useRef<TransactionFormSubmitPayload | null>(null)

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

    const failedRequest = failedRequestRef.current
    const requestPayload: TransactionFormSubmitPayload = payload.draft.clientRequestId
      ? payload
      : failedRequest && isSameDraft(failedRequest.draft, payload.draft)
        ? {
            ...payload,
            draft: failedRequest.draft,
          }
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

    try {
      const result = await service.saveTransaction(requestPayload.draft)
      setRecentSaved(result.transaction)
      setFormResetState(payload.resetState)
      failedRequestRef.current = null
      setStatusMessage('저장이 완료되었습니다.')
    } catch (error) {
      setStatusMessage('')
      if (isAppError(error) && error.code === 'TRANSFER_INTEGRITY') {
        failedRequestRef.current = null
      } else {
        failedRequestRef.current = requestPayload
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
      <div className="page-intro page-intro--inline">
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
