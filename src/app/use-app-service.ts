import { useContext, useEffect, useState } from 'react'
import {
  AppServiceContext,
  type AppAuthState,
  type TransactionReferenceData,
} from '@/app/app-service-core.ts'

const EMPTY_REFERENCE_DATA: TransactionReferenceData = {
  accounts: [],
  categories: [],
}

export function useAppService() {
  return useContext(AppServiceContext)
}

export function useAppAuth() {
  const service = useAppService()
  return service.auth
}

export function useCurrentYearMonth() {
  const service = useAppService()
  return {
    currentYear: service.currentYear,
    currentMonth: service.currentMonth,
  }
}

export function useReferenceData(year?: number) {
  const service = useAppService()
  const [data, setData] = useState<TransactionReferenceData>(EMPTY_REFERENCE_DATA)
  const targetYear = year ?? service.currentYear
  const canRead = service.auth.canRead
  const getReferenceData = service.getReferenceData

  useEffect(() => {
    let active = true

    if (!canRead) {
      setData(EMPTY_REFERENCE_DATA)
      return () => {
        active = false
      }
    }

    void getReferenceData(targetYear).then((value) => {
      if (active) {
        setData(value)
      }
    }).catch(() => {
      if (active) {
        setData(EMPTY_REFERENCE_DATA)
      }
    })

    return () => {
      active = false
    }
  }, [canRead, getReferenceData, targetYear])

  return data
}

export function useAuthGuard(): AppAuthState {
  const service = useAppService()
  return service.auth
}
