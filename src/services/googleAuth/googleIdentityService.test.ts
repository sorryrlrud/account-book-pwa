import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleIdentityService } from './googleIdentityService.ts'
import { InMemoryTokenStore } from './tokenStore.ts'
import { AccountHintStore } from './accountHintStore.ts'

const env = {
  googleClientId: 'client-id',
  bootstrapSpreadsheetId: 'bootstrap-id',
}

beforeEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GoogleIdentityService', () => {
  it('fails gracefully when GIS is unavailable', async () => {
    const service = new GoogleIdentityService({
      env,
      windowRef: {} as never,
    })

    await expect(service.requestAccessToken()).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    })
  })

  it('requests a token without repeating consent and uses requested scopes as fallback', async () => {
    let requestedPrompt = ''
    const service = new GoogleIdentityService({
      env,
      windowRef: {
        google: {
          accounts: {
            oauth2: {
              initTokenClient: ({
                callback,
                scope,
                client_id,
              }: {
                callback: (response: {
                  access_token?: string
                  expires_in?: number
                  error?: string
                  error_description?: string
                  scope?: string
                }) => void
                scope: string
                client_id: string
              }) => {
                expect(client_id).toBe('client-id')
                expect(scope).toBe('scope:a scope:b openid')

                return {
                  requestAccessToken: (override?: { prompt?: string }) => {
                    const prompt = override?.prompt ?? ''
                    requestedPrompt = prompt ?? ''
                    callback({
                      access_token: 'token-123',
                      expires_in: 3600,
                    })
                  },
                }
              },
            },
          },
        },
      } as never,
    })

    const snapshot = await service.requestAccessToken(['scope:a', 'scope:b'])

    expect(requestedPrompt).toBe('')
    expect(snapshot.accessToken).toBe('token-123')
    expect(snapshot.scopes).toEqual(['scope:a', 'scope:b', 'openid'])
    expect(service.tokenStore.get()).toMatchObject({
      accessToken: 'token-123',
    })
  })

  it('uses the returned scope list when GIS provides it', async () => {
    const service = new GoogleIdentityService({
      env,
      windowRef: {
        google: {
          accounts: {
            oauth2: {
              initTokenClient: ({
                callback,
              }: {
                callback: (response: {
                  access_token?: string
                  expires_in?: number
                  error?: string
                  error_description?: string
                  scope?: string
                }) => void
              }) => ({
                requestAccessToken: () => {
                  callback({
                    access_token: 'token-123',
                    expires_in: 3600,
                    scope: 'scope:sheets scope:email',
                  })
                },
              }),
            },
          },
        },
      } as never,
    })

    const snapshot = await service.requestAccessToken()

    expect(snapshot.scopes).toEqual(['scope:sheets', 'scope:email'])
  })

  it('maps GIS errors to AUTH_REQUIRED', async () => {
    const service = new GoogleIdentityService({
      env,
      windowRef: {
        google: {
          accounts: {
            oauth2: {
              initTokenClient: ({
                callback,
              }: {
                callback: (response: {
                  access_token?: string
                  expires_in?: number
                  error?: string
                  error_description?: string
                  scope?: string
                }) => void
              }) => ({
                requestAccessToken: () => {
                  callback({
                    error: 'access_denied',
                    error_description: 'user denied',
                  })
                },
              }),
            },
          },
        },
      } as never,
    })

    await expect(service.requestAccessToken()).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    })
  })

  it('finishes with a useful error when the popup is closed', async () => {
    const service = new GoogleIdentityService({
      env,
      windowRef: {
        google: {
          accounts: {
            oauth2: {
              initTokenClient: ({
                error_callback,
              }: {
                error_callback: (error: { type: string }) => void
              }) => ({
                requestAccessToken: () => {
                  error_callback({ type: 'popup_closed' })
                },
              }),
            },
          },
        },
      } as never,
    })

    await expect(service.requestAccessToken()).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
      userMessage: 'Google 로그인 창이 닫혔습니다. 다시 시도해주세요.',
    })
  })

  it('reuses a valid Sheets-only session even before GIS has loaded', async () => {
    const tokenStore = new InMemoryTokenStore()
    const snapshot = {
      accessToken: 'existing-token',
      expiresAt: Date.now() + 3_600_000,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }
    tokenStore.set(snapshot)
    const service = new GoogleIdentityService({ env, tokenStore, windowRef: {} as never })

    await expect(service.requestAccessToken()).resolves.toEqual(snapshot)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['expired', 'missing-scope', 'switch-account'])(
    'does not reuse a token for %s', async (reason) => {
      const tokenStore = new InMemoryTokenStore()
      tokenStore.set({
        accessToken: 'existing-token',
        expiresAt: Date.now() + (reason === 'expired' ? -1 : 3_600_000),
        scopes: reason === 'missing-scope' ? ['openid'] : ['https://www.googleapis.com/auth/spreadsheets'],
      })
      const service = new GoogleIdentityService({ env, tokenStore, windowRef: {} as never })

      await expect(service.requestAccessToken(
        undefined, reason === 'switch-account' ? 'select_account' : '',
      )).rejects.toMatchObject({ code: 'UNAVAILABLE' })
    },
  )

  it('remembers only the account ID across launches and skips account selection on reconnect', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      sub: 'google-subject-123',
      email: 'private@example.com',
    })))
    const initTokenClient = vi.fn(({ callback }) => ({
      requestAccessToken: () => callback({ access_token: 'new-token', expires_in: 3600 }),
    }))
    const windowRef = { google: { accounts: { oauth2: { initTokenClient } } } } as never
    const firstSession = new GoogleIdentityService({ env, windowRef })
    await firstSession.requestAccessToken()
    await vi.waitFor(() => expect(new AccountHintStore(env).get()).toBe('google-subject-123'))

    expect(Object.values(window.localStorage)).toEqual(['google-subject-123'])
    expect(fetch).toHaveBeenCalledWith('https://openidconnect.googleapis.com/v1/userinfo',
      expect.objectContaining({ headers: { Authorization: 'Bearer new-token' }, cache: 'no-store' }))
    window.sessionStorage.clear()
    vi.mocked(fetch).mockResolvedValue(new Response('{}'))

    const nextSession = new GoogleIdentityService({ env, windowRef })
    await nextSession.requestAccessToken()
    expect(initTokenClient).toHaveBeenLastCalledWith(expect.objectContaining({
      login_hint: 'google-subject-123', prompt: '',
    }))
  })

  it('omits a remembered account when the user switches accounts', async () => {
    const accountHintStore = new AccountHintStore(env)
    accountHintStore.set('previous-account')
    const requestAccessToken = vi.fn()
    const initTokenClient = vi.fn(({ error_callback }) => {
      requestAccessToken.mockImplementation(() => error_callback({ type: 'popup_closed' }))
      return { requestAccessToken }
    })
    const service = new GoogleIdentityService({
      env, accountHintStore,
      windowRef: { google: { accounts: { oauth2: { initTokenClient } } } } as never,
    })

    await expect(service.requestAccessToken(undefined, 'select_account')).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
    expect(initTokenClient.mock.calls[0][0]).not.toHaveProperty('login_hint')
    expect(requestAccessToken).toHaveBeenCalledWith({ prompt: 'select_account' })
    expect(accountHintStore.get()).toBeUndefined()
  })

  it('does not restore an account hint after logout while its lookup is still pending', async () => {
    let finishLookup!: (response: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => { finishLookup = resolve }))
    const accountHintStore = new AccountHintStore(env)
    const initTokenClient = ({ callback }: { callback: (response: unknown) => void }) => ({
      requestAccessToken: () => callback({ access_token: 'new-token', expires_in: 3600 }),
    })
    const service = new GoogleIdentityService({
      env, accountHintStore,
      windowRef: { google: { accounts: { oauth2: { initTokenClient } } } } as never,
    })
    await service.requestAccessToken()
    service.forgetAccount()
    const response = new Response(JSON.stringify({ sub: 'late-account' }))
    const readProfile = vi.spyOn(response, 'json')
    finishLookup(response)

    await vi.waitFor(() => expect(readProfile).toHaveBeenCalled())
    expect(accountHintStore.get()).toBeUndefined()
  })

  it('continues login when the optional account lookup fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('offline'))
    const initTokenClient = ({ callback }: { callback: (response: unknown) => void }) => ({
      requestAccessToken: () => callback({ access_token: 'new-token', expires_in: 3600 }),
    })
    const service = new GoogleIdentityService({
      env,
      windowRef: { google: { accounts: { oauth2: { initTokenClient } } } } as never,
    })

    await expect(service.requestAccessToken()).resolves.toMatchObject({ accessToken: 'new-token' })
    expect(service.tokenStore.requireValidToken().accessToken).toBe('new-token')
  })
})
