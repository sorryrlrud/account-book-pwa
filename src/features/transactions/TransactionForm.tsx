import { useEffect, useId, useState } from 'react'
import { formatDateHeading, shiftDate } from '@/features/transactions/date.ts'
import { toAmountInput } from '@/features/transactions/format.ts'
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
    amountInput: `${Math.abs(transaction.amount)}`,
    description: transaction.description,
    account: transaction.account,
    category: transaction.category ?? '',
    destinationAccount: transaction.destinationAccount ?? '',
  }
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

  useEffect(() => {
    if (initialTransaction) {
      setForm(buildEditState(initialTransaction))
      return
    }

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
  }, [accounts, categories, initialTransaction])

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
    if (!form.date || Number.isNaN(new Date(form.date).getTime())) {
      return '날짜를 확인해 주세요.'
    }

    const amount = Number(form.amountInput)
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

    if (!form.category) {
      return '분류를 선택해 주세요.'
    }

    return ''
  }

  const validationError = validate()

  const handleReset = () => {
    if (initialTransaction) {
      setForm(buildEditState(initialTransaction))
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
      amount: Number(form.amountInput),
      description: form.description.trim(),
      account: form.account,
      category: form.type === 'transfer' ? undefined : form.category,
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
    <form className="panel transaction-form" onSubmit={handleSubmit}>
      <div className="panel__header">
        <div>
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
            aria-selected={form.type === type}
            className={`segmented__button${form.type === type ? ' is-active' : ''}`}
            onClick={() => handleTypeChange(type)}
            disabled={isBusy}
          >
            {TAB_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="date-wheel" aria-label="날짜 조절">
        <button
          type="button"
          className="icon-button icon-button--soft"
          onClick={() => setField('date', shiftDate(form.date, -1))}
          disabled={isBusy}
          aria-label="하루 이전"
        >
          {'<'}
        </button>
        <label className="field field--centered" htmlFor={`${formId}-date`}>
          <span>날짜</span>
          <input
            id={`${formId}-date`}
            type="date"
            value={form.date}
            onChange={(event) => setField('date', event.target.value)}
            disabled={isBusy}
          />
        </label>
        <button
          type="button"
          className="icon-button icon-button--soft"
          onClick={() => setField('date', shiftDate(form.date, 1))}
          disabled={isBusy}
          aria-label="하루 이후"
        >
          {'>'}
        </button>
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
            {accounts.map((account) => (
              <option key={account} value={account}>
                {account}
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
              {accounts.map((account) => (
                <option key={account} value={account}>
                  {account}
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
              <option value="" disabled>
                카테고리 선택
              </option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {budgetHint ? <p className="budget-hint">{budgetHint}</p> : null}
          </div>
        )}
      </div>

      {validationMessage ? <p className="form-error">{validationMessage}</p> : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
      {statusMessage ? <p className="form-status">{statusMessage}</p> : null}

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
