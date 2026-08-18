import { useEffect, useId, useState } from 'react'
import { formatDateHeading, shiftDate } from '@/features/transactions/date.ts'
import { parseAmountInput, toAmountInput } from '@/features/transactions/format.ts'
import type {
  EntryMode,
  EntryTab,
  TransactionFormState,
  TransactionFormSubmitPayload,
} from '@/features/transactions/types.ts'
import type { Transaction } from '@/domain/transaction.ts'
import { toIsoDateInKst } from '@/utils/date.ts'

interface TransactionFormProps {
  mode?: EntryMode
  title: string
  accounts: string[]
  categories: string[]
  isBusy: boolean
  isWriteEnabled?: boolean
  submitLabel: string
  errorMessage: string
  statusMessage: string
  budgetHint?: string
  initialTransaction?: Transaction
  resetState?: TransactionFormState | null
  onSubmit: (payload: TransactionFormSubmitPayload) => Promise<void> | void
  onStateChange?: (state: TransactionFormState) => void
  onCancel?: () => void
}

const TAB_LABELS: Record<EntryTab, string> = {
  expense: '지출',
  income: '수입',
  transfer: '이체',
}

function buildCreateState(
  accounts: string[],
  type: EntryTab = 'expense',
): TransactionFormState {
  return {
    type,
    date: toIsoDateInKst(),
    amountInput: '',
    description: '',
    account: accounts[0] ?? '',
    category: '',
    destinationAccount: accounts[1] ?? accounts[0] ?? '',
  }
}

function buildEditState(transaction: Transaction): TransactionFormState {
  return {
    type: transaction.type === 'unknown' ? 'expense' : transaction.type,
    date: transaction.date,
    amountInput: toAmountInput(`${Math.abs(transaction.amount)}`),
    description: transaction.description,
    account: transaction.account,
    category: transaction.category ?? '',
    destinationAccount: transaction.destinationAccount ?? '',
  }
}

function buildOptions(activeItems: string[], retainedItems: Array<string | undefined>) {
  const active = new Set(activeItems)
  const retained = [...new Set(retainedItems.filter(
    (item): item is string => Boolean(item) && !active.has(item as string),
  ))]

  return [
    ...retained.map((value) => ({ value, label: `${value} (사용중지)` })),
    ...activeItems.map((value) => ({ value, label: value })),
  ]
}

export function TransactionForm({
  mode = 'create',
  title,
  accounts,
  categories,
  isBusy,
  isWriteEnabled = true,
  submitLabel,
  errorMessage,
  statusMessage,
  budgetHint,
  initialTransaction,
  resetState,
  onSubmit,
  onStateChange,
  onCancel,
}: TransactionFormProps) {
  const formId = useId()
  const [form, setForm] = useState<TransactionFormState>(() =>
    initialTransaction
      ? buildEditState(initialTransaction)
      : buildCreateState(accounts),
  )
  const [validationMessage, setValidationMessage] = useState('')
  const [typeConfirmed, setTypeConfirmed] = useState(
    initialTransaction?.type !== 'unknown',
  )

  useEffect(() => {
    if (initialTransaction) return
    setForm((current) => {
      const nextAccount = current.account || accounts[0] || ''
      const nextDestination =
        current.destinationAccount ||
        accounts.find((item) => item !== nextAccount) ||
        nextAccount

      return {
        ...current,
        account: nextAccount,
        destinationAccount: nextDestination ?? '',
      }
    })
  }, [accounts, initialTransaction])

  useEffect(() => {
    if (initialTransaction) {
      setForm(buildEditState(initialTransaction))
      setValidationMessage('')
      setTypeConfirmed(initialTransaction.type !== 'unknown')
    }
  }, [initialTransaction])

  useEffect(() => {
    if (resetState && !initialTransaction) {
      setForm(resetState)
      setValidationMessage('')
    }
  }, [initialTransaction, resetState])

  useEffect(() => {
    onStateChange?.(form)
  }, [form, onStateChange])

  const setField = <Key extends keyof TransactionFormState>(
    key: Key,
    value: TransactionFormState[Key],
  ) => {
    setValidationMessage('')
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleTypeChange = (type: EntryTab) => {
    setValidationMessage('')
    setTypeConfirmed(true)
    setForm((current) => ({
      ...current,
      type,
      category: current.category,
      destinationAccount:
        type === 'transfer'
          ? current.destinationAccount ||
            accounts.find((item) => item !== current.account) ||
            ''
          : current.destinationAccount,
    }))
  }

  const validate = () => {
    if (initialTransaction?.type === 'unknown' && !typeConfirmed) {
      return '기존 거래의 유형을 지출·수입·이체 중에서 확인해 주세요.'
    }

    if (!form.date || Number.isNaN(new Date(form.date).getTime())) {
      return '날짜를 확인해 주세요.'
    }

    const amount = parseAmountInput(form.amountInput)
    if (!Number.isFinite(amount) || amount <= 0) {
      return '금액은 0보다 큰 숫자여야 합니다.'
    }

    if (!form.description.trim()) {
      return '내용을 입력해 주세요.'
    }

    if (!form.account) {
      return form.type === 'transfer'
        ? '출금 통장을 선택해 주세요.'
        : '통장을 선택해 주세요.'
    }

    if (form.type === 'transfer') {
      if (!form.destinationAccount) {
        return '입금 통장을 선택해 주세요.'
      }

      if (form.account === form.destinationAccount) {
        return '출금 통장과 입금 통장은 달라야 합니다.'
      }

      return ''
    }

    return ''
  }

  const validationError = validate()
  const contextualValidationMessage = validationMessage || (
    form.type === 'transfer' &&
    form.account &&
    form.destinationAccount &&
    form.account === form.destinationAccount
      ? validationError
      : ''
  )
  const referenceMessage = accounts.length === 0
    ? '설정에서 사용할 통장을 먼저 등록해 주세요.'
    : ''
  const accountOptions = buildOptions(accounts, [
    initialTransaction?.account,
    initialTransaction?.destinationAccount,
  ])
  const categoryOptions = buildOptions(categories, [initialTransaction?.category])

  const handleReset = () => {
    if (initialTransaction) {
      setForm(buildEditState(initialTransaction))
      setTypeConfirmed(initialTransaction.type !== 'unknown')
      return
    }

    setForm((current) => ({
      ...buildCreateState(accounts, current.type),
      date: current.date,
      account: current.account || accounts[0] || '',
      category: '',
      destinationAccount:
        current.destinationAccount ||
        accounts.find((item) => item !== current.account) ||
        current.account,
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextValidation = validate()
    if (nextValidation) {
      setValidationMessage(nextValidation)
      return
    }

    const draft = {
      type: form.type,
      date: form.date,
      amount: parseAmountInput(form.amountInput),
      description: form.description.trim(),
      account: form.account,
      category: form.type === 'transfer' || !form.category ? undefined : form.category,
      destinationAccount:
        form.type === 'transfer' ? form.destinationAccount : undefined,
    }

    const resetStateValue: TransactionFormState = {
      ...form,
      amountInput: '',
      description: '',
      category: '',
    }

    await onSubmit({
      transaction: initialTransaction,
      draft,
      resetState: resetStateValue,
    })
  }

  return (
    <form
      className={`panel transaction-form transaction-form--${form.type}`}
      onSubmit={handleSubmit}
    >
      <div className="panel__header">
        <div className="transaction-form__heading">
          <h2>{title}</h2>
          <p className="panel__description">{formatDateHeading(form.date)}</p>
        </div>
        {onCancel ? (
          <button
            type="button"
            className="text-button"
            onClick={onCancel}
            disabled={isBusy}
          >
            닫기
          </button>
        ) : null}
      </div>

      <div
        className="segmented"
        role="tablist"
        aria-label={`${mode === 'edit' ? '수정할' : '새'} 거래 유형`}
      >
        {(Object.keys(TAB_LABELS) as EntryTab[]).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={typeConfirmed && form.type === type}
            className={`segmented__button${typeConfirmed && form.type === type ? ' is-active' : ''}`}
            onClick={() => handleTypeChange(type)}
            disabled={isBusy}
          >
            {TAB_LABELS[type]}
          </button>
        ))}
      </div>

      {initialTransaction?.type === 'unknown' && !typeConfirmed ? (
        <p className="form-status" role="status">
          이 거래는 원장에서 유형을 판단할 수 없습니다. 저장하기 전에 거래 유형을 선택해 주세요.
        </p>
      ) : null}

      <div className="date-wheel" aria-label="날짜 조절">
        <label className="date-wheel__label" htmlFor={`${formId}-date`}>
          날짜
        </label>
        <div className="date-wheel__controls">
          <button
            type="button"
            className="icon-button icon-button--soft"
            onClick={() => setField('date', shiftDate(form.date, -1))}
            disabled={isBusy}
            aria-label="하루 이전"
          >
            <span className="icon-button__emoji" aria-hidden="true">◀️</span>
          </button>
          <input
            id={`${formId}-date`}
            type="date"
            value={form.date}
            onChange={(event) => setField('date', event.target.value)}
            disabled={isBusy}
          />
          <button
            type="button"
            className="icon-button icon-button--soft"
            onClick={() => setField('date', shiftDate(form.date, 1))}
            disabled={isBusy}
            aria-label="하루 이후"
          >
            <span className="icon-button__emoji" aria-hidden="true">▶️</span>
          </button>
        </div>
      </div>

      <label className="field" htmlFor={`${formId}-amount`}>
        <span>금액</span>
        <input
          id={`${formId}-amount`}
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={form.amountInput}
          onChange={(event) =>
            setField('amountInput', toAmountInput(event.target.value))
          }
          disabled={isBusy}
        />
      </label>

      <label className="field" htmlFor={`${formId}-description`}>
        <span>내용</span>
        <input
          id={`${formId}-description`}
          placeholder="예: 점심 식사"
          value={form.description}
          onChange={(event) => setField('description', event.target.value)}
          disabled={isBusy}
        />
      </label>

      <div className="field-row">
        <label className="field" htmlFor={`${formId}-account`}>
          <span>{form.type === 'transfer' ? '출금 통장' : '통장'}</span>
          <select
            id={`${formId}-account`}
            value={form.account}
            onChange={(event) => setField('account', event.target.value)}
            disabled={isBusy}
          >
            <option value="" disabled>
              통장을 선택하세요
            </option>
            {accountOptions.map((account) => (
              <option key={account.value} value={account.value}>
                {account.label}
              </option>
            ))}
          </select>
        </label>

        {form.type === 'transfer' ? (
          <label className="field" htmlFor={`${formId}-destination`}>
            <span>입금 통장</span>
            <select
              id={`${formId}-destination`}
              value={form.destinationAccount}
              onChange={(event) =>
                setField('destinationAccount', event.target.value)
              }
              disabled={isBusy}
            >
              <option value="" disabled>
                입금 통장 선택
              </option>
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="field">
            <label htmlFor={`${formId}-category`}>카테고리</label>
            <select
              id={`${formId}-category`}
              value={form.category}
              onChange={(event) => setField('category', event.target.value)}
              disabled={isBusy}
            >
              <option value="">
                카테고리 없음
              </option>
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            {budgetHint ? <p className="budget-hint">{budgetHint}</p> : null}
          </div>
        )}
      </div>

      {contextualValidationMessage ? <p className="form-error" role="alert">{contextualValidationMessage}</p> : null}
      {referenceMessage ? <p className="form-status" role="status">{referenceMessage}</p> : null}
      {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}
      {statusMessage ? <p className="form-status" role="status" aria-live="polite">{statusMessage}</p> : null}

      <div className="form-actions">
        <button
          type="submit"
          className="primary-button"
          disabled={isBusy || !isWriteEnabled || Boolean(validationError)}
        >
          {isBusy ? '처리 중...' : submitLabel}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={handleReset}
          disabled={isBusy}
        >
          초기화
        </button>
      </div>
    </form>
  )
}
