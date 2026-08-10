import { useCallback, useEffect, useMemo, useState } from 'react'
import { type HistoryFilters } from '@/app/app-service-core.ts'
import { useAppService, useReferenceData } from '@/app/use-app-service.ts'
import { currentMonthValue, formatDateHeading, formatMonthLabel, shiftMonth } from '@/features/transactions/date.ts'
import { formatKrw } from '@/features/transactions/format.ts'
import { TransactionForm } from '@/features/transactions/TransactionForm.tsx'
import type { Transaction } from '@/domain/transaction.ts'
import type { TransactionFormSubmitPayload } from '@/features/transactions/types.ts'

const DEFAULT_FILTERS: HistoryFilters = {
  month: currentMonthValue(),
  search: '',
  type: 'all',
  account: '',
  category: '',
}

export function HistoryPage() {
  const service = useAppService()
  const { accounts, categories } = useReferenceData()
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('이번 달 내역을 불러올 수 있습니다.')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)

  const loadTransactions = useCallback(async (nextFilters: HistoryFilters) => {
    setIsLoading(true)
    setErrorMessage('')
    setStatusMessage('내역을 불러오는 중입니다.')

    try {
      const result = await service.listTransactions(nextFilters)
      setTransactions(result)
      setStatusMessage(result.length ? '내역을 불러왔습니다.' : '표시할 내역이 없습니다.')
    } catch (error) {
      setTransactions([])
      setStatusMessage('')
      setErrorMessage(
        error instanceof Error ? error.message : '내역을 불러오지 못했습니다.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [service])

  useEffect(() => {
    void loadTransactions(filters)
  }, [filters, loadTransactions])

  const filteredTransactions = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return transactions.filter((transaction) => {
      if (filters.type !== 'all' && transaction.type !== filters.type) {
        return false
      }

      if (filters.account && transaction.account !== filters.account) {
        return false
      }

      if (filters.category && (transaction.category ?? '') !== filters.category) {
        return false
      }

      if (!query) {
        return true
      }

      return transaction.description.toLowerCase().includes(query)
    })
  }, [filters.account, filters.category, filters.search, filters.type, transactions])

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce<Record<string, Transaction[]>>(
      (groups, transaction) => {
        const key = transaction.date
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(transaction)
        return groups
      },
      {},
    )
  }, [filteredTransactions])

  const handleRefresh = () => {
    void loadTransactions(filters)
  }

  const handleUpdate = async (payload: TransactionFormSubmitPayload) => {
    if (!payload.transaction) {
      return
    }

    setIsSaving(true)
    setErrorMessage('')
    setStatusMessage('수정 요청을 보내는 중입니다.')

    try {
      await service.updateTransaction(payload.transaction, payload.draft)
      setEditing(null)
      await loadTransactions(filters)
      setStatusMessage('수정이 완료되었습니다.')
    } catch (error) {
      setStatusMessage('')
      setErrorMessage(
        error instanceof Error ? error.message : '수정 중 오류가 발생했습니다.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) {
      return
    }

    setIsDeleting(true)
    setErrorMessage('')
    setStatusMessage('삭제 요청을 보내는 중입니다.')

    try {
      await service.deleteTransaction(pendingDelete)
      setPendingDelete(null)
      setEditing(null)
      await loadTransactions(filters)
      setStatusMessage('삭제가 완료되었습니다.')
    } catch (error) {
      setStatusMessage('')
      setErrorMessage(
        error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="page">
      <div className="page-intro">
        <h2>내역</h2>
        <p>월별 거래를 찾고 필요한 항목을 수정할 수 있습니다.</p>
      </div>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>{formatMonthLabel(filters.month)}</h2>
            <p className="panel__description">현재 월 기준으로 내역을 조회합니다.</p>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            새로고침
          </button>
        </div>

        <div className="month-switcher">
          <button
            type="button"
            className="icon-button icon-button--soft"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                month: shiftMonth(current.month, -1),
              }))
            }
            disabled={isLoading}
            aria-label="이전 달"
          >
            {'<'}
          </button>
          <input
            type="month"
            value={filters.month}
            onChange={(event) =>
              setFilters((current) => ({ ...current, month: event.target.value }))
            }
            aria-label="조회 월"
          />
          <button
            type="button"
            className="icon-button icon-button--soft"
            onClick={() =>
              setFilters((current) => ({
                ...current,
                month: shiftMonth(current.month, 1),
              }))
            }
            disabled={isLoading}
            aria-label="다음 달"
          >
            {'>'}
          </button>
        </div>

        <div className="compact-filters">
          <label className="field">
            <span>검색</span>
            <input
              value={filters.search}
              placeholder="내용 검색"
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>유형</span>
            <select
              value={filters.type}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  type: event.target.value as HistoryFilters['type'],
                }))
              }
            >
              <option value="all">전체</option>
              <option value="expense">지출</option>
              <option value="income">수입</option>
              <option value="transfer">이체</option>
              <option value="unknown">미분류</option>
            </select>
          </label>
          <label className="field">
            <span>계좌</span>
            <select
              value={filters.account}
              onChange={(event) =>
                setFilters((current) => ({ ...current, account: event.target.value }))
              }
            >
              <option value="">전체</option>
              {accounts.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>분류</span>
            <select
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({ ...current, category: event.target.value }))
              }
            >
              <option value="">전체</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
      </section>

      {editing ? (
        <>
          <TransactionForm
            mode="edit"
            title="거래 수정"
            accounts={accounts}
            categories={categories}
            isBusy={isSaving}
            isWriteEnabled={service.hasWriteAccess}
            submitLabel="변경사항 저장"
            errorMessage={errorMessage}
            statusMessage={statusMessage}
            initialTransaction={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
          <button
            type="button"
            className="secondary-button secondary-button--full secondary-button--danger"
            disabled={isSaving || !service.hasWriteAccess}
            onClick={() => setPendingDelete(editing)}
          >
            거래 삭제
          </button>
        </>
      ) : null}

      {pendingDelete ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h2>삭제 확인</h2>
              <p className="panel__description">
                {pendingDelete.description} 항목을 삭제하시겠습니까?
              </p>
            </div>
          </div>
          <div className="form-actions form-actions--pair">
            <button
              type="button"
              className="primary-button primary-button--danger"
              disabled={isDeleting}
              onClick={() => {
                void handleDelete()
              }}
            >
              {isDeleting ? '처리 중...' : '삭제'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPendingDelete(null)}
              disabled={isDeleting}
            >
              취소
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>월별 내역</h2>
            <p className="panel__description">
              필터 결과 {filteredTransactions.length}건
            </p>
          </div>
        </div>

        {Object.keys(groupedTransactions).length ? (
          <div className="history-groups">
            {Object.entries(groupedTransactions).map(([date, items]) => (
              <section key={date} className="history-group">
                <h3>{formatDateHeading(date)}</h3>
                <div className="history-list">
                  {items.map((transaction) => (
                    <button
                      type="button"
                      key={transaction.id ?? `${date}-${transaction.description}-${transaction.amount}`}
                      className="history-item history-item--button"
                      onClick={() => setEditing(transaction)}
                    >
                      <div>
                        <strong>{transaction.description}</strong>
                        <p>
                          {transaction.account}
                          {transaction.destinationAccount
                            ? ` → ${transaction.destinationAccount}`
                            : ''}
                          {transaction.category ? ` · ${transaction.category}` : ''}
                        </p>
                      </div>
                      <div className="history-item__meta">
                        <strong>
                          {formatKrw(
                            transaction.type === 'transfer'
                              ? Math.abs(transaction.amount)
                              : transaction.amount,
                          )}
                        </strong>
                        <span className="history-item__edit-label">수정</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            조건에 맞는 거래가 없습니다.
          </p>
        )}
      </section>
    </section>
  )
}
