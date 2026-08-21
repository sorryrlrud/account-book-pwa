import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  AppServiceContext,
  type AppService,
} from '@/app/app-service-core.ts'
import { AppServiceController } from '@/app/app-service-controller.ts'

export function AppServiceProvider({ children }: { children: ReactNode }) {
  const controllerRef = useRef<AppServiceController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = new AppServiceController()
  }

  const controller = controllerRef.current
  useEffect(() => {
    void controller.resumeSession()
  }, [controller])

  const snapshot = useSyncExternalStore(
    controller.subscribe.bind(controller),
    controller.getSnapshot.bind(controller),
    controller.getSnapshot.bind(controller),
  )

  const actions = useMemo<Omit<AppService, keyof typeof snapshot>>(() => ({
    login: () => controller.login(),
    relogin: () => controller.relogin(),
    logout: () => controller.logout(),
    bootstrap: () => controller.bootstrap(),
    setCurrentYearMonth: (year, month) => controller.setCurrentYearMonth(year, month),
    getReferenceData: (year) => controller.getReferenceData(year),
    listTransactions: (filters) => controller.listTransactions(filters),
    saveTransaction: (draft) => controller.saveTransaction(draft),
    updateTransaction: (transaction, draft) =>
      controller.updateTransaction(transaction, draft),
    deleteTransaction: (transaction) => controller.deleteTransaction(transaction),
    getBudgets: (year, month) => controller.getBudgets(year, month),
    getBudgetMaximum: (year, month) => controller.getBudgetMaximum(year, month),
    saveBudgetPlan: (year, month, input) => controller.saveBudgetPlan(year, month, input),
    getSettingsData: (year) => controller.getSettingsData(year),
    createBudgetGroup: (year, input) => controller.createBudgetGroup(year, input),
    createAccount: (year, input) => controller.createAccount(year, input),
    renameAccount: (year, previousName, nextName) =>
      controller.renameAccount(year, previousName, nextName),
    disableAccount: (year, name) => controller.disableAccount(year, name),
    createCategory: (year, input) => controller.createCategory(year, input),
    renameCategory: (year, previousName, nextName) =>
      controller.renameCategory(year, previousName, nextName),
    disableCategory: (year, name) => controller.disableCategory(year, name),
    getYearGraph: () => controller.getYearGraph(),
    linkYear: (request) => controller.linkYear(request),
    syncMonthZero: (year) => controller.syncMonthZero(year),
    getSettlement: (year, month) => controller.getSettlement(year, month),
    getInvestment: (year, month) => controller.getInvestment(year, month),
    getEnergy: (year, month) => controller.getEnergy(year, month),
    openGoogleSheet: (year) => controller.openGoogleSheet(year),
  }), [controller])

  const service = useMemo<AppService>(() => ({
    ...snapshot,
    ...actions,
  }), [actions, snapshot])

  return (
    <AppServiceContext.Provider value={service}>
      {children}
    </AppServiceContext.Provider>
  )
}
