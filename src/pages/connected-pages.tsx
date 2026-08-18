import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppService } from '@/app/use-app-service.ts'
import type { BudgetGroup, MonthlyBudget } from '@/domain/budget.ts'
import type { SettlementSummary } from '@/domain/settlement.ts'
import type { BudgetGroupView } from '@/features/budgets/types.ts'
import type {
  EditableAccount,
  EditableCategory,
  SettingsConfirmation,
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

interface PageMonthControl {
  selection: YearMonth
  shift: (amount: number) => void
  canGoPrevious: boolean
  canGoNext: boolean
  notice?: string
}

function usePageMonth(): PageMonthControl {
  const service = useAppService()
  const [selection, setSelection] = useState<YearMonth>({
    year: service.currentYear,
    month: service.currentMonth,
  })
  const [linkedYears, setLinkedYears] = useState<Set<number>>()
  const getYearGraph = service.getYearGraph
  const setCurrentYearMonth = service.setCurrentYearMonth

  useEffect(() => {
    let active = true
    void getYearGraph()
      .then((graph) => {
        if (active) setLinkedYears(new Set(graph.years.keys()))
      })
      .catch(() => {
        if (active) setLinkedYears(new Set([selection.year]))
      })
    return () => { active = false }
  }, [getYearGraph, selection.year])

  const previous = shiftYearMonth(selection, -1)
  const next = shiftYearMonth(selection, 1)
  const canMoveTo = (target: YearMonth) =>
    target.year === selection.year || Boolean(linkedYears?.has(target.year))
  const canGoPrevious = canMoveTo(previous)
  const canGoNext = canMoveTo(next)

  const shift = (amount: number) => {
    setSelection((current) => {
      const next = shiftYearMonth(current, amount)
      if (next.year !== current.year && !linkedYears?.has(next.year)) {
        return current
      }
      setCurrentYearMonth(next.year, next.month)
      return next
    })
  }

  const notice = linkedYears && selection.month === 1 && !canGoPrevious
    ? `${selection.year - 1}년 Sheet가 연결되지 않았습니다. 설정에서 연도를 연결하세요.`
    : linkedYears && selection.month === 12 && !canGoNext
      ? `${selection.year + 1}년 Sheet가 연결되지 않았습니다. 설정에서 연도를 연결하세요.`
      : undefined

  return { selection, shift, canGoPrevious, canGoNext, notice }
}

export function ConnectedBudgetPage() {
  const service = useAppService()
  const monthControl = usePageMonth()
  const { selection } = monthControl
  const [groups, setGroups] = useState<BudgetGroupView[]>([])
  const [selectedGroupName, setSelectedGroupName] = useState('')
  const [draft, setDraft] = useState({ groupName: '', amount: '' })
  const [baseBudgetDraft, setBaseBudgetDraft] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [confirmAdjustment, setConfirmAdjustment] = useState(false)
  const [confirmBaseBudget, setConfirmBaseBudget] = useState(false)
  const [resetGroupName, setResetGroupName] = useState('')
  const [isMutating, setIsMutating] = useState(false)
  const getSettingsData = service.getSettingsData
  const getBudgets = service.getBudgets

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    setGroups([])
    try {
      const [settings, budgets] = await Promise.all([
        getSettingsData(selection.year),
        getBudgets(selection.year, selection.month),
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
      setSelectedGroupName((current) => {
        const nextSelected = nextGroups.some((group) => group.group.name === current)
          ? current
          : ''
        const selected = nextGroups.find((group) => group.group.name === nextSelected)
        setDraft({
          groupName: nextSelected,
          amount: selected ? String(selected.monthly.adjustment) : '',
        })
        setBaseBudgetDraft(selected ? String(selected.group.baseMonthlyBudget) : '')
        return nextSelected
      })
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
  }, [getBudgets, getSettingsData, selection.month, selection.year])

  useEffect(() => {
    void load()
  }, [load])

  const adjustmentAmount = Number(draft.amount.replaceAll(',', ''))
  const baseBudgetAmount = Number(baseBudgetDraft.replaceAll(',', ''))
  const submitAdjustment = () => {
    if (!draft.groupName || !draft.amount.trim() || !Number.isFinite(adjustmentAmount)) {
      setError('예산 그룹과 조정 금액을 확인해주세요.')
      return
    }
    setConfirmAdjustment(true)
  }

  const applyAdjustment = async () => {
    setConfirmAdjustment(false)
    setError('')
    setIsMutating(true)
    try {
      await service.updateBudget(
        selection.year,
        selection.month,
        draft.groupName,
        adjustmentAmount,
      )
      await load()
      setStatus('예산 조정을 저장했습니다.')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : '예산 조정을 저장하지 못했습니다.',
      )
    } finally {
      setIsMutating(false)
    }
  }

  const submitBaseBudget = () => {
    if (!draft.groupName || !baseBudgetDraft.trim() || !Number.isFinite(baseBudgetAmount) || baseBudgetAmount < 0) {
      setError('예산 그룹과 기준 월예산을 확인해주세요.')
      return
    }
    setConfirmBaseBudget(true)
  }

  const applyBaseBudget = async () => {
    setConfirmBaseBudget(false)
    setError('')
    setIsMutating(true)
    try {
      await service.updateBudgetGroupBase(selection.year, draft.groupName, baseBudgetAmount)
      await load()
      setStatus('기준 월예산을 변경했습니다.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '기준 월예산을 저장하지 못했습니다.')
    } finally {
      setIsMutating(false)
    }
  }

  const resetCarryOver = async () => {
    const groupName = resetGroupName
    setResetGroupName('')
    setError('')
    setIsMutating(true)
    try {
      await service.resetBudget(selection.year, selection.month, groupName)
      await load()
      setStatus('현재 이월금을 수동조정으로 초기화했습니다.')
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : '이월금을 초기화하지 못했습니다.',
      )
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <>
      <PageNotice busy={isLoading || isMutating} error={error} status={status} />
      <BudgetPage
        year={selection.year}
        month={selection.month}
        groups={groups}
        selectedGroupName={selectedGroupName}
        adjustmentDraft={draft}
        baseBudgetDraft={baseBudgetDraft}
        adjustmentError={error}
        isBusy={isLoading || isMutating}
        canWrite={service.hasWriteAccess}
        monthNotice={monthControl.notice}
        adjustmentConfirmation={confirmAdjustment ? {
          open: true,
          title: '예산 조정을 적용할까요?',
          description: `${draft.groupName}의 이번 달 조정을 ${adjustmentAmount.toLocaleString('ko-KR')}원으로 저장합니다.`,
          confirmLabel: '적용',
          busy: isMutating,
          onConfirm: () => { void applyAdjustment() },
          onCancel: () => setConfirmAdjustment(false),
        } : undefined}
        resetConfirmation={resetGroupName ? {
          open: true,
          title: '이월금을 초기화할까요?',
          description: '현재 이월금만큼 반대 방향 수동조정을 기록합니다. 기준 월예산은 바뀌지 않습니다.',
          confirmLabel: '초기화',
          busy: isMutating,
          tone: 'danger',
          onConfirm: () => { void resetCarryOver() },
          onCancel: () => setResetGroupName(''),
        } : undefined}
        baseBudgetConfirmation={confirmBaseBudget ? {
          open: true,
          title: '기준 월예산을 변경할까요?',
          description: `${draft.groupName}의 이후 월별 기준값을 ${baseBudgetAmount.toLocaleString('ko-KR')}원으로 변경합니다. 저장된 월별 스냅샷은 유지됩니다.`,
          confirmLabel: '변경',
          busy: isMutating,
          onConfirm: () => { void applyBaseBudget() },
          onCancel: () => setConfirmBaseBudget(false),
        } : undefined}
        canGoPrevious={monthControl.canGoPrevious && !isLoading && !isMutating}
        canGoNext={monthControl.canGoNext && !isLoading && !isMutating}
        onPreviousMonth={() => monthControl.shift(-1)}
        onNextMonth={() => monthControl.shift(1)}
        onSelectGroup={(groupName) => {
          const nextGroupName = selectedGroupName === groupName ? '' : groupName
          setSelectedGroupName(nextGroupName)
          const selected = groups.find((group) => group.group.name === groupName)
          setDraft({
            groupName: nextGroupName,
            amount: nextGroupName && selected ? String(selected.monthly.adjustment) : '',
          })
          setBaseBudgetDraft(nextGroupName && selected ? String(selected.group.baseMonthlyBudget) : '')
        }}
        onAdjustmentDraftChange={setDraft}
        onBaseBudgetDraftChange={setBaseBudgetDraft}
        onSubmitBaseBudget={submitBaseBudget}
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
  const monthControl = usePageMonth()
  const { selection } = monthControl
  const [summary, setSummary] = useState(EMPTY_SETTLEMENT)
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const getSettlement = service.getSettlement
  const getBudgets = service.getBudgets

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')
    setSummary({
      ...EMPTY_SETTLEMENT,
      year: selection.year,
      month: selection.month,
    })
    setBudgets([])
    void Promise.all([
      getSettlement(selection.year, selection.month),
      getBudgets(selection.year, selection.month),
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
  }, [getBudgets, getSettlement, selection.month, selection.year])

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
        canGoPrevious={monthControl.canGoPrevious && !isLoading}
        canGoNext={monthControl.canGoNext && !isLoading}
        monthNotice={monthControl.notice}
        onPreviousMonth={() => monthControl.shift(-1)}
        onNextMonth={() => monthControl.shift(1)}
      />
    </>
  )
}

export function ConnectedInvestmentPage() {
  const service = useAppService()
  const selection = { year: service.currentYear, month: service.currentMonth }
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof service.getInvestment>>>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const getInvestment = service.getInvestment

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')
    setSummary(undefined)
    void getInvestment(selection.year, selection.month)
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
  }, [getInvestment, selection.month, selection.year])

  return (
    <>
      <PageNotice busy={isLoading} />
      <InvestmentPage
        {...selection}
        summary={summary}
        formatError={error}
      />
    </>
  )
}

export function ConnectedEnergyPage() {
  const service = useAppService()
  const selection = { year: service.currentYear, month: service.currentMonth }
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof service.getEnergy>>>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const getEnergy = service.getEnergy

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setError('')
    setSummary(undefined)
    void getEnergy(selection.year, selection.month)
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
  }, [getEnergy, selection.month, selection.year])

  return (
    <>
      <PageNotice busy={isLoading} />
      <EnergyPage
        {...selection}
        summary={summary}
        formatError={error}
      />
    </>
  )
}

export function ConnectedSettingsPage() {
  const service = useAppService()
  const year = service.currentYear
  const [accounts, setAccounts] = useState<EditableAccount[]>([])
  const [categories, setCategories] = useState<EditableCategory[]>([])
  const [budgetGroups, setBudgetGroups] = useState<string[]>([])
  const [budgetGroupItems, setBudgetGroupItems] = useState<BudgetGroup[]>([])
  const [yearLinks, setYearLinks] = useState<Array<{
    year: number
    spreadsheetId: string
    connected: boolean
    spreadsheetUrl: string
  }>>([])
  const [newAccountName, setNewAccountName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryBudgetGroup, setNewCategoryBudgetGroup] = useState('')
  const [newBudgetGroupName, setNewBudgetGroupName] = useState('')
  const [newBudgetGroupBase, setNewBudgetGroupBase] = useState('')
  const [yearLinkDraft, setYearLinkDraft] = useState({ year: '', spreadsheetUrl: '' })
  const [pendingAction, setPendingAction] = useState<{
    title: string
    description: string
    confirmLabel: string
    tone?: SettingsConfirmation['tone']
    run: () => Promise<unknown>
    successMessage: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const mutationRef = useRef(false)
  const getSettingsData = service.getSettingsData

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await getSettingsData(year)
      setAccounts(data.accounts.map((account) => ({ ...account, draftName: account.name })))
      setCategories(data.categories.map((category) => ({ ...category, draftName: category.name })))
      setBudgetGroups(
        data.budgetGroups
          .filter((group) => group.active)
          .sort((left, right) => left.order - right.order)
          .map((group) => group.name),
      )
      setBudgetGroupItems(data.budgetGroups)
      setYearLinks(data.linkedYears.map((linkedYear) => ({
        ...linkedYear,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${linkedYear.spreadsheetId}/edit`,
      })))
      return true
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '설정을 불러오지 못했습니다.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [getSettingsData, year])

  useEffect(() => {
    void load()
  }, [load])

  const runMutation = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ): Promise<boolean> => {
    if (mutationRef.current) return false
    mutationRef.current = true
    setIsMutating(true)
    setError('')
    setStatus('')
    try {
      await action()
      const refreshed = await load()
      if (!refreshed) return false
      setStatus(successMessage)
      return true
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : '설정을 저장하지 못했습니다.')
      return false
    } finally {
      mutationRef.current = false
      setIsMutating(false)
    }
  }

  const renameAccount = (accountName: string) => {
    const draftName = accounts.find((account) => account.name === accountName)?.draftName.trim()
    if (!draftName || draftName === accountName) return
    setPendingAction({
      title: '통장 이름을 변경할까요?',
      description: `통장 이름을 “${accountName}” → “${draftName}”로 바꾸고 ${year}년 1~12월 거래에도 반영합니다.`,
      confirmLabel: '이름 변경',
      run: () => service.renameAccount(year, accountName, draftName),
      successMessage: '통장 이름을 변경했습니다.',
    })
  }

  const renameCategory = (categoryName: string) => {
    const draftName = categories.find((category) => category.name === categoryName)?.draftName.trim()
    if (!draftName || draftName === categoryName) return
    setPendingAction({
      title: '카테고리 이름을 변경할까요?',
      description: `카테고리 이름을 “${categoryName}” → “${draftName}”로 바꾸고 ${year}년 1~12월 거래에도 반영합니다.`,
      confirmLabel: '이름 변경',
      run: () => service.renameCategory(year, categoryName, draftName),
      successMessage: '카테고리 이름을 변경했습니다.',
    })
  }

  const connectedYearNumbers = useMemo(
    () => new Set(yearLinks.map((item) => item.year)),
    [yearLinks],
  )
  const isBusy = isLoading || isMutating
  const canSyncMonthZero = connectedYearNumbers.has(year - 1)

  return (
    <>
      <PageNotice busy={isBusy} error={error} status={status} />
      <SettingsPage
        newAccountName={newAccountName}
        newCategoryName={newCategoryName}
        newCategoryBudgetGroup={newCategoryBudgetGroup}
        newBudgetGroupName={newBudgetGroupName}
        newBudgetGroupBase={newBudgetGroupBase}
        budgetGroups={budgetGroups}
        budgetGroupItems={budgetGroupItems}
        accounts={accounts}
        categories={categories}
        yearLinks={yearLinks}
        yearLinkDraft={yearLinkDraft}
        confirmation={pendingAction ? {
          open: true,
          title: pendingAction.title,
          description: pendingAction.description,
          confirmLabel: pendingAction.confirmLabel,
          tone: pendingAction.tone,
          onConfirm: () => {
            const action = pendingAction
            setPendingAction(null)
            void runMutation(
              action.run,
              action.successMessage,
            )
          },
          onCancel: () => setPendingAction(null),
        } : undefined}
        isBusy={isBusy}
        canWrite={service.hasWriteAccess}
        canSyncMonthZero={canSyncMonthZero}
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
          ).then((saved) => {
            if (saved) setNewAccountName('')
          })
        }}
        onAccountDisableToggle={(accountName, active) => {
          if (active) return
          setPendingAction({
            title: '통장을 사용중지할까요?',
            description: `“${accountName}” 통장을 신규 거래 목록에서 숨깁니다. 기존 거래는 그대로 유지됩니다.`,
            confirmLabel: '사용중지',
            tone: 'danger',
            run: () => service.disableAccount(year, accountName),
            successMessage: '통장을 사용중지했습니다.',
          })
        }}
        onAccountRename={renameAccount}
        onNewCategoryNameChange={setNewCategoryName}
        onNewBudgetGroupNameChange={setNewBudgetGroupName}
        onNewBudgetGroupBaseChange={setNewBudgetGroupBase}
        onBudgetGroupCreate={() => {
          const name = newBudgetGroupName.trim()
          const baseMonthlyBudget = Number(newBudgetGroupBase.replaceAll(',', ''))
          if (!name || !Number.isFinite(baseMonthlyBudget) || baseMonthlyBudget < 0) {
            setError('예산 그룹 이름과 기준 월예산을 확인해주세요.')
            return
          }
          void runMutation(
            () => service.createBudgetGroup(year, { name, baseMonthlyBudget }),
            '예산 그룹을 추가했습니다.',
          ).then((saved) => {
            if (saved) {
              setNewBudgetGroupName('')
              setNewBudgetGroupBase('')
            }
          })
        }}
        onNewCategoryBudgetGroupChange={setNewCategoryBudgetGroup}
        onCategoryDraftNameChange={(categoryName, draftName) => {
          setCategories((current) => current.map((category) =>
            category.name === categoryName ? { ...category, draftName } : category,
          ))
        }}
        onCategoryCreate={() => {
          const name = newCategoryName.trim()
          if (!name) return
          void runMutation(
            () => service.createCategory(year, {
              name,
              budgetGroup: newCategoryBudgetGroup || undefined,
            }),
            '카테고리를 추가했습니다.',
          ).then((saved) => {
            if (saved) {
              setNewCategoryName('')
              setNewCategoryBudgetGroup('')
            }
          })
        }}
        onCategoryDisableToggle={(categoryName, active) => {
          if (active) return
          setPendingAction({
            title: '카테고리를 사용중지할까요?',
            description: `“${categoryName}” 카테고리를 신규 거래 목록에서 숨깁니다. 기존 거래는 그대로 유지됩니다.`,
            confirmLabel: '사용중지',
            tone: 'danger',
            run: () => service.disableCategory(year, categoryName),
            successMessage: '카테고리를 사용중지했습니다.',
          })
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
          ).then((saved) => {
            if (saved) setYearLinkDraft({ year: '', spreadsheetUrl: '' })
          })
        }}
        onRequestMonthZeroSync={() => setPendingAction({
          title: `${year}년 0월 데이터를 업데이트할까요?`,
          description: `${year - 1}년 12월 데이터를 다시 가져옵니다. ${year}년 통장 잔액 및 예산 계산 결과가 변경될 수 있습니다.`,
          confirmLabel: '업데이트',
          tone: 'danger',
          run: () => service.syncMonthZero(year),
          successMessage: '0월 Snapshot을 업데이트했습니다.',
        })}
        onOpenSheet={(targetYear) => service.openGoogleSheet(targetYear)}
        onLogout={() => {
          if (mutationRef.current) return
          mutationRef.current = true
          setIsMutating(true)
          setError('')
          void service.logout()
            .catch((logoutError: unknown) => {
              setError(logoutError instanceof Error ? logoutError.message : '로그아웃하지 못했습니다.')
            })
            .finally(() => {
              mutationRef.current = false
              setIsMutating(false)
            })
        }}
      />
    </>
  )
}
