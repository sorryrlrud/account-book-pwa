import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppService } from '@/app/use-app-service.ts'
import type { MonthlyBudget } from '@/domain/budget.ts'
import type { SettlementSummary } from '@/domain/settlement.ts'
import type { BudgetGroupView } from '@/features/budgets/types.ts'
import type {
  EditableAccount,
  EditableCategory,
} from '@/features/settings/types.ts'
import BudgetPage from '@/pages/BudgetPage.tsx'
import EnergyPage from '@/pages/EnergyPage.tsx'
import InvestmentPage from '@/pages/InvestmentPage.tsx'
import SettingsPage from '@/pages/SettingsPage.tsx'
import SettlementPage from '@/pages/SettlementPage.tsx'

interface YearMonth {
  year: number
  month: number
}

function shiftYearMonth(current: YearMonth, amount: number): YearMonth {
  const date = new Date(Date.UTC(current.year, current.month - 1 + amount, 1))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  }
}

function PageNotice({
  busy,
  error,
  status,
}: {
  busy?: boolean
  error?: string
  status?: string
}) {
  if (!busy && !error && !status) {
    return null
  }

  return (
    <div
      className={error ? 'form-error connected-page__notice' : 'form-status connected-page__notice'}
      role={error ? 'alert' : 'status'}
      aria-live="polite"
    >
      {busy ? '불러오는 중입니다.' : error || status}
    </div>
  )
}

function usePageMonth(): [YearMonth, (amount: number) => void] {
  const service = useAppService()
  const [selection, setSelection] = useState<YearMonth>({
    year: service.currentYear,
    month: service.currentMonth,
  })

  const shift = (amount: number) => {
    setSelection((current) => {
      const next = shiftYearMonth(current, amount)
      service.setCurrentYearMonth(next.year, next.month)
      return next
    })
  }

  return [selection, shift]
}

export function ConnectedBudgetPage() {
  const service = useAppService()
  const [selection, shiftMonth] = usePageMonth()
  const [groups, setGroups] = useState<BudgetGroupView[]>([])
  const [selectedGroupName, setSelectedGroupName] = useState('')
  const [draft, setDraft] = useState({ groupName: '', amount: '', reason: '' })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [confirmAdjustment, setConfirmAdjustment] = useState(false)
  const [resetGroupName, setResetGroupName] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const [settings, budgets] = await Promise.all([
        service.getSettingsData(selection.year),
        service.getBudgets(selection.year, selection.month),
      ])
      const budgetByName = new Map(
        budgets.map((budget) => [budget.groupName, budget]),
      )
      const nextGroups = settings.budgetGroups
        .filter((group) => group.active)
        .flatMap((group): BudgetGroupView[] => {
          const monthly = budgetByName.get(group.name)
          if (!monthly) {
            return []
          }
          return [{
            group,
            monthly,
            details: [
              { label: '기준 월예산', amount: monthly.baseSnapshot },
              { label: '전월 이월', amount: monthly.carryOver },
              { label: '이번 달 조정', amount: monthly.adjustment },
            ],
            note: monthly.remaining < 0
              ? `${Math.abs(monthly.remaining).toLocaleString('ko-KR')}원 초과`
              : `${monthly.remaining.toLocaleString('ko-KR')}원 남음`,
          }]
        })
      setGroups(nextGroups)
      const nextSelected = nextGroups.some(
        (group) => group.group.name === selectedGroupName,
      )
        ? selectedGroupName
        : (nextGroups[0]?.group.name ?? '')
      setSelectedGroupName(nextSelected)
      setDraft((current) => ({ ...current, groupName: nextSelected }))
      setStatus(nextGroups.length ? '' : '표시할 예산 그룹이 없습니다.')
    } catch (loadError) {
      setGroups([])
      setError(
        loadError instanceof Error
          ? loadError.message
          : '예산을 불러오지 못했습니다.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [selection.month, selection.year, selectedGroupName, service])

  useEffect(() => {
    void load()
  }, [load])

  const adjustmentAmount = Number(draft.amount.replaceAll(',', ''))
  const submitAdjustment = () => {
    if (!draft.groupName || !Number.isFinite(adjustmentAmount)) {
      setError('예산 그룹과 조정 금액을 확인해주세요.')
      return
    }
    setConfirmAdjustment(true)
  }

  const applyAdjustment = async () => {
    setConfirmAdjustment(false)
    setError('')
    try {
      await service.updateBudget(
        selection.year,
        selection.month,
        draft.groupName,
        adjustmentAmount,
      )
      setStatus('예산 조정을 저장했습니다.')
      await load()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : '예산 조정을 저장하지 못했습니다.',
      )
    }
  }

  const resetCarryOver = async () => {
    const groupName = resetGroupName
    setResetGroupName('')
    setError('')
    try {
      await service.resetBudget(selection.year, selection.month, groupName)
      setStatus('현재 이월금을 수동조정으로 초기화했습니다.')
      await load()
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : '이월금을 초기화하지 못했습니다.',
      )
    }
  }

  return (
    <>
      <PageNotice busy={isLoading} error={error} status={status} />
      <BudgetPage
        year={selection.year}
        month={selection.month}
        groups={groups}
        selectedGroupName={selectedGroupName}
        adjustmentDraft={draft}
        adjustmentError={error}
        adjustmentConfirmation={confirmAdjustment ? {
          open: true,
          title: '예산 조정을 적용할까요?',
          description: `${draft.groupName}의 이번 달 조정을 ${adjustmentAmount.toLocaleString('ko-KR')}원으로 저장합니다.`,
          confirmLabel: '적용',
          onConfirm: () => { void applyAdjustment() },
          onCancel: () => setConfirmAdjustment(false),
        } : undefined}
        resetConfirmation={resetGroupName ? {
          open: true,
          title: '이월금을 초기화할까요?',
          description: '현재 이월금만큼 반대 방향 수동조정을 기록합니다. 기준 월예산은 바뀌지 않습니다.',
          confirmLabel: '초기화',
          onConfirm: () => { void resetCarryOver() },
          onCancel: () => setResetGroupName(''),
        } : undefined}
        onPreviousMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
        onSelectGroup={(groupName) => {
          setSelectedGroupName(groupName)
          setDraft((current) => ({ ...current, groupName }))
        }}
        onAdjustmentDraftChange={setDraft}
        onSubmitAdjustment={submitAdjustment}
        onRequestResetCarryOver={setResetGroupName}
      />
    </>
  )
}

const EMPTY_SETTLEMENT: SettlementSummary = {
  year: 0,
  month: 0,
  income: 0,
  expense: 0,
  accounts: [],
}

export function ConnectedSettlementPage() {
  const service = useAppService()
  const [selection, shiftMonth] = usePageMonth()
  const [summary, setSummary] = useState(EMPTY_SETTLEMENT)
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')
    void Promise.all([
      service.getSettlement(selection.year, selection.month),
      service.getBudgets(selection.year, selection.month),
    ])
      .then(([nextSummary, nextBudgets]) => {
        if (active) {
          setSummary(nextSummary)
          setBudgets(nextBudgets)
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : '정산을 불러오지 못했습니다.',
          )
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [selection.month, selection.year, service])

  return (
    <>
      <PageNotice busy={isLoading} error={error} />
      <SettlementPage
        summary={summary.year ? summary : { ...summary, ...selection }}
        budgets={budgets.map((budget) => ({
          groupName: budget.groupName,
          effectiveBudget: budget.effectiveBudget,
          spent: budget.spent,
          remaining: budget.remaining,
        }))}
        onPreviousMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
      />
    </>
  )
}

export function ConnectedInvestmentPage() {
  const service = useAppService()
  const [selection, shiftMonth] = usePageMonth()
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof service.getInvestment>>>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')
    void service.getInvestment(selection.year, selection.month)
      .then((nextSummary) => {
        if (active) setSummary(nextSummary)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '투자 현황을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [selection.month, selection.year, service])

  return (
    <>
      <PageNotice busy={isLoading} />
      <InvestmentPage
        {...selection}
        summary={summary}
        formatError={error}
        onPreviousMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
      />
    </>
  )
}

export function ConnectedEnergyPage() {
  const service = useAppService()
  const [selection, shiftMonth] = usePageMonth()
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof service.getEnergy>>>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')
    void service.getEnergy(selection.year, selection.month)
      .then((nextSummary) => {
        if (active) setSummary(nextSummary)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '에너지 현황을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [selection.month, selection.year, service])

  return (
    <>
      <PageNotice busy={isLoading} />
      <EnergyPage
        {...selection}
        summary={summary}
        formatError={error}
        onPreviousMonth={() => shiftMonth(-1)}
        onNextMonth={() => shiftMonth(1)}
      />
    </>
  )
}

export function ConnectedSettingsPage() {
  const service = useAppService()
  const year = service.currentYear
  const [accounts, setAccounts] = useState<EditableAccount[]>([])
  const [categories, setCategories] = useState<EditableCategory[]>([])
  const [yearLinks, setYearLinks] = useState<Array<{
    year: number
    spreadsheetId: string
    connected: boolean
    spreadsheetUrl: string
  }>>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [yearLinkDraft, setYearLinkDraft] = useState({ year: '', spreadsheetUrl: '' })
  const [syncConfirmationOpen, setSyncConfirmationOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await service.getSettingsData(year)
      setAccounts(data.accounts.map((account) => ({ ...account, draftName: account.name })))
      setCategories(data.categories.map((category) => ({ ...category, draftName: category.name })))
      setYearLinks(data.linkedYears.map((linkedYear) => ({
        ...linkedYear,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${linkedYear.spreadsheetId}/edit`,
      })))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '설정을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [service, year])

  useEffect(() => {
    void load()
  }, [load])

  const runMutation = async (action: () => Promise<unknown>, successMessage: string) => {
    setError('')
    setStatus('')
    try {
      await action()
      setStatus(successMessage)
      await load()
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : '설정을 저장하지 못했습니다.')
    }
  }

  const renameAccount = (accountName: string) => {
    const draftName = accounts.find((account) => account.name === accountName)?.draftName.trim()
    if (!draftName || draftName === accountName) return
    if (!window.confirm(`${accountName}을(를) ${draftName}(으)로 바꾸고 현재 연도 1~12월 거래에도 반영할까요?`)) return
    void runMutation(
      () => service.renameAccount(year, accountName, draftName),
      '통장 이름을 변경했습니다.',
    )
  }

  const renameCategory = (categoryName: string) => {
    const draftName = categories.find((category) => category.name === categoryName)?.draftName.trim()
    if (!draftName || draftName === categoryName) return
    if (!window.confirm(`${categoryName}을(를) ${draftName}(으)로 바꾸고 현재 연도 1~12월 거래에도 반영할까요?`)) return
    void runMutation(
      () => service.renameCategory(year, categoryName, draftName),
      '카테고리 이름을 변경했습니다.',
    )
  }

  const connectedYearNumbers = useMemo(
    () => new Set(yearLinks.map((item) => item.year)),
    [yearLinks],
  )

  return (
    <>
      <PageNotice busy={isLoading} error={error} status={status} />
      <SettingsPage
        newAccountName={newAccountName}
        newCategoryName={newCategoryName}
        accounts={accounts}
        categories={categories}
        yearLinks={yearLinks}
        yearLinkDraft={yearLinkDraft}
        syncConfirmation={syncConfirmationOpen ? {
          open: true,
          title: `${year}년 0월 데이터를 업데이트할까요?`,
          description: `${year - 1}년 12월 데이터를 다시 가져옵니다. ${year}년 통장 잔액 및 예산 계산 결과가 변경될 수 있습니다.`,
          confirmLabel: '업데이트',
          onConfirm: () => {
            setSyncConfirmationOpen(false)
            void runMutation(
              () => service.syncMonthZero(year),
              '0월 Snapshot을 업데이트했습니다.',
            )
          },
          onCancel: () => setSyncConfirmationOpen(false),
        } : undefined}
        onNewAccountNameChange={setNewAccountName}
        onAccountDraftNameChange={(accountName, draftName) => {
          setAccounts((current) => current.map((account) =>
            account.name === accountName ? { ...account, draftName } : account,
          ))
        }}
        onAccountCreate={() => {
          const name = newAccountName.trim()
          if (!name) return
          void runMutation(
            () => service.createAccount(year, { name }),
            '통장을 추가했습니다.',
          ).then(() => setNewAccountName(''))
        }}
        onAccountDisableToggle={(accountName, active) => {
          if (active || !window.confirm(`${accountName}을(를) 신규 거래 목록에서 숨길까요? 기존 거래는 유지됩니다.`)) return
          void runMutation(
            () => service.disableAccount(year, accountName),
            '통장을 사용중지했습니다.',
          )
        }}
        onAccountRename={renameAccount}
        onNewCategoryNameChange={setNewCategoryName}
        onCategoryDraftNameChange={(categoryName, draftName) => {
          setCategories((current) => current.map((category) =>
            category.name === categoryName ? { ...category, draftName } : category,
          ))
        }}
        onCategoryCreate={() => {
          const name = newCategoryName.trim()
          if (!name) return
          void runMutation(
            () => service.createCategory(year, { name }),
            '카테고리를 추가했습니다.',
          ).then(() => setNewCategoryName(''))
        }}
        onCategoryDisableToggle={(categoryName, active) => {
          if (active || !window.confirm(`${categoryName}을(를) 신규 거래 목록에서 숨길까요? 기존 거래는 유지됩니다.`)) return
          void runMutation(
            () => service.disableCategory(year, categoryName),
            '카테고리를 사용중지했습니다.',
          )
        }}
        onCategoryRename={renameCategory}
        onYearLinkDraftChange={setYearLinkDraft}
        onYearLinkSubmit={() => {
          const targetYear = Number(yearLinkDraft.year)
          if (!Number.isInteger(targetYear) || !yearLinkDraft.spreadsheetUrl.trim()) {
            setError('연도와 Spreadsheet URL을 확인해주세요.')
            return
          }
          if (connectedYearNumbers.has(targetYear)) {
            setError('이미 연결된 연도입니다.')
            return
          }
          void runMutation(
            () => service.linkYear({
              year: targetYear,
              spreadsheetUrl: yearLinkDraft.spreadsheetUrl.trim(),
            }),
            '연도별 Sheet를 연결했습니다.',
          ).then(() => setYearLinkDraft({ year: '', spreadsheetUrl: '' }))
        }}
        onRequestMonthZeroSync={() => setSyncConfirmationOpen(true)}
        onOpenSheet={(targetYear) => service.openGoogleSheet(targetYear)}
        onLogout={() => { void service.logout() }}
      />
    </>
  )
}
