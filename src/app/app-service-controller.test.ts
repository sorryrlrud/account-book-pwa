import { afterEach, describe, expect, it, vi } from 'vitest'
import { REQUIRED_CORE_SHEETS } from '@/services/sheets/schema.ts'
import { jsonResponse } from '../../tests/fixtures/googleApi.ts'
import { AppServiceController } from './app-service-controller.ts'
import { AccountHintStore } from '@/services/googleAuth/accountHintStore.ts'

const env = {
  VITE_GOOGLE_CLIENT_ID: 'resume-client-id',
  VITE_BOOTSTRAP_SPREADSHEET_ID: 'resume-sheet-id',
} as ImportMetaEnv

const storageKey =
  'account-book.google-access-token:resume-client-id:resume-sheet-id'

afterEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('AppServiceController session restore', () => {
  it('treats session restoration as a no-op when app settings are missing', async () => {
    const controller = new AppServiceController({
      envSource: {} as ImportMetaEnv,
      windowRef: window,
      tokenStorage: window.sessionStorage,
    })

    await expect(controller.resumeSession()).resolves.toBeUndefined()
    expect(controller.getSnapshot().auth.status).toBe('unconfigured')
  })

  it('bootstraps a valid stored session without opening Google login', async () => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      accessToken: 'stored-token',
      expiresAt: Date.now() + 3_600_000,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }))

    const fetchImpl = vi.fn<typeof fetch>((input) => {
      const url = String(input)
      if (url.includes('/values/')) {
        return Promise.resolve(jsonResponse({
          values: [
            ['key', 'value'],
            ['year', '2026'],
            ['schemaVersion', '1'],
            ['environment', 'TEST'],
          ],
        }))
      }

      return Promise.resolve(jsonResponse({
        spreadsheetId: 'resume-sheet-id',
        properties: { title: '가계부 2026 TEST' },
        sheets: REQUIRED_CORE_SHEETS.map((title, index) => ({
          properties: { sheetId: index + 1, title },
        })),
      }))
    })
    vi.stubGlobal('fetch', fetchImpl)

    const controller = new AppServiceController({
      envSource: env,
      windowRef: window,
      tokenStorage: window.sessionStorage,
    })

    expect(controller.getSnapshot().auth.isBusy).toBe(true)
    await Promise.all([controller.resumeSession(), controller.login()])

    expect(controller.getSnapshot().auth).toMatchObject({
      status: 'ready',
      isAuthenticated: true,
      requiresLogin: false,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('leaves an expired stored session signed out without API requests', async () => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      accessToken: 'expired-token',
      expiresAt: Date.now() - 1,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }))
    const fetchImpl = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchImpl)

    const controller = new AppServiceController({
      envSource: env,
      windowRef: window,
      tokenStorage: window.sessionStorage,
    })

    await controller.resumeSession()

    expect(controller.getSnapshot().auth.status).toBe('signed_out')
    expect(window.sessionStorage.getItem(storageKey)).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('exits the loading state when the sheet schema is invalid', async () => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      accessToken: 'stored-token',
      expiresAt: Date.now() + 3_600_000,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }))
    vi.stubGlobal('fetch', vi.fn<typeof fetch>((input) => {
      if (String(input).includes('/values/')) {
        return Promise.resolve(jsonResponse({ values: [['key', 'value']] }))
      }
      return Promise.resolve(jsonResponse({
        spreadsheetId: 'resume-sheet-id',
        sheets: [],
      }))
    }))

    const controller = new AppServiceController({
      envSource: env,
      windowRef: window,
      tokenStorage: window.sessionStorage,
    })

    await controller.resumeSession()

    expect(controller.getSnapshot().auth).toMatchObject({
      status: 'unavailable',
      isBusy: false,
      errorCode: 'SCHEMA_MISMATCH',
    })

    // Retrying a schema/connection failure should recheck the sheet using the
    // existing token, even if Google's login script is unavailable.
    await expect(controller.login()).rejects.toMatchObject({ code: 'SCHEMA_MISMATCH' })
    expect(controller.getSnapshot().auth.errorCode).toBe('SCHEMA_MISMATCH')
    expect(window.sessionStorage.getItem(storageKey)).toContain('stored-token')
  })

  it('never treats a remembered account as an authorized session', async () => {
    new AccountHintStore({
      googleClientId: 'resume-client-id', bootstrapSpreadsheetId: 'resume-sheet-id',
    }).set('remembered-account')
    const fetchImpl = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchImpl)
    const controller = new AppServiceController({ envSource: env })

    await controller.resumeSession()

    expect(controller.getSnapshot().auth).toMatchObject({ status: 'signed_out', canRead: false, canWrite: false })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('clears both the session token and the remembered account on logout', async () => {
    const accountHintStore = new AccountHintStore({
      googleClientId: 'resume-client-id', bootstrapSpreadsheetId: 'resume-sheet-id',
    })
    accountHintStore.set('remembered-account')
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      accessToken: 'stored-token', expiresAt: Date.now() + 3_600_000,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }))
    const controller = new AppServiceController({ envSource: env, windowRef: {} as Window })

    await controller.logout()

    expect(controller.getSnapshot().auth.status).toBe('signed_out')
    expect(window.sessionStorage.getItem(storageKey)).toBeNull()
    expect(window.localStorage.length).toBe(0)
  })
})
