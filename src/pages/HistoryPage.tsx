import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type HistoryFilters } from '@/app/app-service-core.ts'
import { useAppService, useReferenceData } from '@/app/use-app-service.ts'
import { currentMonthValue, formatDateHeading, formatMonthLabel, shiftMonth } from '@/features/transactions/date.ts'
import { formatKrw } from '@/features/transactions/format.ts'
import { TransactionForm } from '@/features/transactions/TransactionForm.tsx'
import type { Transaction } from '@/domain/transaction.ts'
import type { AccountBalance } from '@/domain/account.ts'
import type { TransactionFormSubmitPayload } from '@/features/transactions/types.ts'

const DEFAULT_FILTERS: HistoryFilters = {
  month: currentMonthValue(),
  search: '',
  type: 'all',
  account: '',
  category: '',
}

const DEFAULT_YEAR = Number(DEFAULT_FILTERS.month.slice(0, 4))
type StatisticsType = 'expense' | 'income' | 'account'

export function HistoryPage() {
  const service = useAppService()
  const { accounts, categories } = useReferenceData()
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)
  const [statisticsType, setStatisticsType] = useState<StatisticsType>('expense')
  const [linkedYears, setLinkedYears] = useState<Set<number>>()
  const loadRequestRef = useRef(0)
  const listTransactions = service.listTransactions
  const getAccountBalances = service.getAccountBalances
  const getYearGraph = service.getYearGraph

  useEffect(() => {
    let active = true
    void getYearGraph()
      .then((graph) => {
        if (active) setLinkedYears(new Set(graph.years.keys()))
      })
      .catch(() => {
        if (active) setLinkedYears(new Set([DEFAULT_YEAR]))
      })
    return () => { active = false }
  }, [getYearGraph])

  const loadTransactions = useCallback(async (nextFilters: HistoryFilters) => {
    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    setIsLoading(true)
    setErrorMessage('')
    setStatusMessage('')
    setTransactions([])
    setAccountBalances([])

    try {
      const [year, month] = nextFilters.month.split('-').map(Number)
      const [result, balances] = await Promise.all([
        listTransactions(nextFilters),
        getAccountBalances(year, month),
      ])
      if (loadRequestRef.current !== requestId) return
      setTransactions(result)
      setAccountBalances(balances)
      setStatusMessage('')
    } catch (error) {
      if (loadRequestRef.current !== requestId) return
      setTransactions([])
      setAccountBalances([])
      setStatusMessage('')
      setErrorMessage(
        error instanceof Error ? error.message : '내역을 불러오지 못했습니다.',
      )
    } finally {
      if (loadRequestRef.current === requestId) {
        setIsLoading(false)
      }
    }
  }, [getAccountBalances, listTransactions])

  useEffect(() => {
    void loadTransactions({
      ...DEFAULT_FILTERS,
      month: filters.month,
    })
    setEditing(null)
    setPendingDelete(null)
  }, [filters.month, loadTransactions])

  const filteredTransactions = useMemo(() => {
    const query = filters.search.trim().toLowerCase()

    return transactions.filter((transaction) => {
      if (filters.type !== 'all' && transaction.type !== filters.type) {
        return false
      }

      if (
        filters.account &&
        transaction.account !== filters.account &&
        transaction.destinationAccount !== filters.account
      ) {
        return false
      }

      if (filters.category && (transaction.category ?? '') !== filters.category) {
        return false
      }

      if (!query) {
        return true
      }

      return [
        transaction.description,
        transaction.account,
        transaction.destinationAccount,
        transaction.category,
      ].some((value) => value?.toLowerCase().includes(query))
    })
  }, [filters.account, filters.category, filters.search, filters.type, transactions])

  const groupedTransactions = useMemo(() => {
    return [...filteredTransactions]
      .sort((left, right) => {
        const byDate = right.date.localeCompare(left.date)
        return byDate || (right.sourceRow ?? 0) - (left.sourceRow ?? 0)
      })
      .reduce<Record<string, Transaction[]>>(
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

  const statistics = useMemo(() => {
    const totals = new Map<string, number>()
    for (const transaction of transactions) {
      if (transaction.type === 'transfer') continue
      if (statisticsType !== 'account' && transaction.type !== statisticsType) continue
      const label = statisticsType === 'account'
        ? transaction.account.trim()
        : transaction.category?.trim()
      if (!label) continue
      totals.set(label, (totals.get(label) ?? 0) + Math.abs(transaction.amount))
    }
    const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0)
    return {
      total,
      items: [...totals.entries()]
        .map(([label, amount]) => ({
          label,
          amount,
          ratio: total > 0 ? (amount / total) * 100 : 0,
        }))
        .sort((left, right) => right.amount - left.amount),
    }
  }, [statisticsType, transactions])

  const statisticsLabel = statisticsType === 'expense'
    ? '지출'
    : statisticsType === 'income'
      ? '수입'
      : '통장(카드) 거래'

  const handleRefresh = () => {
    void loadTransactions(filters)
  }

  const toggleAccountFilter = (account: string) => {
    setFilters((current) => ({
      ...current,
      account: current.account === account ? '' : account,
    }))
  }

  const toggleCategoryFilter = (category: string) => {
    setFilters((current) => ({
      ...current,
      category: current.category === category ? '' : category,
    }))
  }

  const handleStatisticsItemClick = (label: string) => {
    if (statisticsType === 'account') {
      toggleAccountFilter(label)
      return
    }
    toggleCategoryFilter(label)
  }

  const moveMonth = (step: number) => {
    const nextMonth = shiftMonth(filters.month, step)
    const currentYear = Number(filters.month.slice(0, 4))
    const nextYear = Number(nextMonth.slice(0, 4))
    if (nextYear !== currentYear && !linkedYears?.has(nextYear)) {
      setStatusMessage(`${nextYear}년 Sheet가 연결되지 않았습니다. 설정에서 연도를 연결하세요.`)
      return
    }
    setFilters((current) => ({ ...current, month: nextMonth }))
  }

  const previousMonth = shiftMonth(filters.month, -1)
  const nextMonth = shiftMonth(filters.month, 1)
  const selectedYear = Number(filters.month.slice(0, 4))
  const previousYear = Number(previousMonth.slice(0, 4))
  const nextYear = Number(nextMonth.slice(0, 4))
  const canGoPrevious = previousYear === selectedYear || Boolean(linkedYears?.has(previousYear))
  const canGoNext = nextYear === selectedYear || Boolean(linkedYears?.has(nextYear))
  const boundaryNotice = linkedYears && !canGoPrevious
    ? `${previousYear}년 Sheet가 연결되지 않았습니다. 설정에서 연도를 연결하세요.`
    : linkedYears && !canGoNext
      ? `${nextYear}년 Sheet가 연결되지 않았습니다. 설정에서 연도를 연결하세요.`
      : ''
  const accountFilterOptions = filters.account && !accounts.includes(filters.account)
    ? [filters.account, ...accounts]
    : accounts
  const categoryFilterOptions = filters.category && !categories.includes(filters.category)
    ? [filters.category, ...categories]
    : categories

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
      <section className="panel history-month-panel">
        <div className="history-month-panel__toolbar">
          <button
            type="button"
            className="icon-button icon-button--soft icon-button--compact"
            onClick={() => moveMonth(-1)}
            disabled={isLoading || !canGoPrevious}
            aria-label="이전 달"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <h2>{formatMonthLabel(filters.month)}</h2>
          <button
            type="button"
            className="icon-button icon-button--soft icon-button--compact"
            onClick={() => moveMonth(1)}
            disabled={isLoading || !canGoNext}
            aria-label="다음 달"
          >
            <span aria-hidden="true">›</span>
          </button>
          <button
            type="button"
            className="icon-button icon-button--compact history-month-panel__refresh"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="새로고침"
          >
            <span aria-hidden="true">↻</span>
          </button>
        </div>

        {boundaryNotice ? <p className="month-navigator__notice">{boundaryNotice}</p> : null}

        {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
      </section>

      <section className="panel account-balances" aria-labelledby="account-balances-title">
        <div className="panel__header">
          <h2 id="account-balances-title">통장별 잔액</h2>
          <p className="panel__caption">{formatMonthLabel(filters.month)} 말 기준</p>
        </div>
        {accountBalances.length ? (
          <div className="account-balances__list">
            {accountBalances.map((account) => (
              <button
                type="button"
                className={`account-balances__item${filters.account === account.account ? ' is-active' : ''}`}
                key={account.account}
                aria-pressed={filters.account === account.account}
                onClick={() => toggleAccountFilter(account.account)}
              >
                <span>{account.account}</span>
                <strong className={account.balance < 0 ? 'is-negative' : ''}>
                  {formatKrw(account.balance)}
                </strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            {isLoading ? '통장 잔액을 불러오는 중입니다.' : '표시할 통장 잔액이 없습니다.'}
          </p>
        )}
      </section>

      <section className="panel category-statistics" aria-labelledby="category-statistics-title">
        <div className="panel__header">
          <div>
            <h2 id="category-statistics-title">카테고리 통계</h2>
            <p className="panel__description">
              월 {statisticsLabel} 합계 {formatKrw(statistics.total)}
            </p>
          </div>
        </div>
        <div className="segmented category-statistics__tabs" role="tablist" aria-label="카테고리 통계 유형">
          {([
            ['expense', '지출'],
            ['income', '수입'],
            ['account', '통장(카드)'],
          ] as const).map(([type, label]) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={statisticsType === type}
              className={`segmented__button${statisticsType === type ? ' is-active' : ''}`}
              onClick={() => setStatisticsType(type)}
            >
              {label}
            </button>
          ))}
        </div>
        {statistics.items.length ? (
          <div className="category-statistics__list">
            {statistics.items.map((item) => (
              <button
                type="button"
                className={`category-statistics__item${(
                  statisticsType === 'account'
                    ? filters.account === item.label
                    : filters.category === item.label
                ) ? ' is-active' : ''}`}
                key={item.label}
                aria-pressed={
                  statisticsType === 'account'
                    ? filters.account === item.label
                    : filters.category === item.label
                }
                onClick={() => handleStatisticsItemClick(item.label)}
              >
                <div className="category-statistics__heading">
                  <strong>{item.label}</strong>
                  <span>{formatKrw(item.amount)} · {Math.round(item.ratio)}%</span>
                </div>
                <div className="category-statistics__track" aria-hidden="true">
                  <div
                    className={`category-statistics__value category-statistics__value--${statisticsType}`}
                    style={{ width: `${item.ratio}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            이 달의 {statisticsLabel} 통계가 없습니다.
          </p>
        )}
      </section>

      <section className="panel history-filter-panel">
        <div className="panel__header">
          <div>
            <h2>필터링 및 검색</h2>
            <p className="panel__description">월별 상세 내역에서 원하는 거래를 찾습니다.</p>
          </div>
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
              {accountFilterOptions.map((account) => (
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
              {categoryFilterOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>

      </section>

      {pendingDelete ? (
        <div className="confirmation-overlay">
        <section className="panel confirmation-dialog history-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="history-delete-title">
          <div className="panel__header">
            <div>
              <h2 id="history-delete-title">삭제 확인</h2>
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
        </div>
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <h2>월별 내역</h2>
          <p className="panel__caption">필터 결과 {filteredTransactions.length}건</p>
        </div>

        {Object.keys(groupedTransactions).length ? (
          <div className="history-groups">
            {Object.entries(groupedTransactions).map(([date, items]) => (
              <section key={date} className="history-group">
                <h3>{formatDateHeading(date)}</h3>
                <div className="history-table-wrap">
                  <table className="history-table">
                    <caption className="sr-only">{formatDateHeading(date)} 거래 내역</caption>
                    <colgroup>
                      <col className="history-table__description-column" />
                      <col className="history-table__amount-column" />
                      <col className="history-table__account-column" />
                      <col className="history-table__category-column" />
                      <col className="history-table__action-column" />
                    </colgroup>
                    <thead className="sr-only">
                      <tr>
                        <th>내용</th>
                        <th>금액</th>
                        <th>통장</th>
                        <th>카테고리</th>
                        <th>수정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((transaction, index) => {
                        const transactionKey = transaction.id ?? `${date}-${transaction.sourceRow ?? index}-${transaction.description}-${transaction.amount}`
                        const isEditing = editing === transaction
                        return (
                          <Fragment key={transactionKey}>
                            <tr className={isEditing ? 'is-editing' : ''}>
                              <td className="history-table__description" title={transaction.description}>
                                {transaction.description}
                              </td>
                              <td className="history-table__amount">
                                {formatKrw(
                                  transaction.type === 'transfer'
                                    ? Math.abs(transaction.amount)
                                    : transaction.amount,
                                )}
                              </td>
                              <td className="history-table__account" title={transaction.account}>
                                {transaction.account}
                                {transaction.destinationAccount ? `→${transaction.destinationAccount}` : ''}
                              </td>
                              <td className="history-table__category" title={transaction.category ?? ''}>
                                {transaction.category ?? '–'}
                              </td>
                              <td className="history-table__action">
                                <button
                                  type="button"
                                  className="text-button history-table__edit-button"
                                  aria-label={`${transaction.description} ${isEditing ? '닫기' : '수정'}`}
                                  aria-expanded={isEditing}
                                  onClick={() => setEditing(isEditing ? null : transaction)}
                                >
                                  {isEditing ? '닫기' : '수정'}
                                </button>
                              </td>
                            </tr>
                            {isEditing ? (
                              <tr className="history-table__editor-row">
                                <td colSpan={5}>
                                  <div className="history-item__editor">
                                    <TransactionForm
                                      mode="edit"
                                      title="거래 수정"
                                      accounts={accounts}
                                      categories={categories}
                                      isBusy={isSaving}
                                      isWriteEnabled={service.hasWriteAccess}
                                      submitLabel="변경사항 저장"
                                      errorMessage=""
                                      statusMessage=""
                                      initialTransaction={editing!}
                                      onSubmit={handleUpdate}
                                      onCancel={() => setEditing(null)}
                                    />
                                    <button
                                      type="button"
                                      className="secondary-button secondary-button--full secondary-button--danger"
                                      disabled={isSaving || !service.hasWriteAccess}
                                      onClick={() => setPendingDelete(editing!)}
                                    >
                                      거래 삭제
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
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
