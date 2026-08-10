import { describe, expect, it } from 'vitest'
import { GoogleIdentityService } from './googleIdentityService.ts'

const env = {
  googleClientId: 'client-id',
  bootstrapSpreadsheetId: 'bootstrap-id',
  testSpreadsheetId: 'bootstrap-id',
}

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

  it('requests a token, stores it in memory, and uses requested scopes as fallback', async () => {
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
                expect(scope).toBe('scope:a scope:b')

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

    expect(requestedPrompt).toBe('consent')
    expect(snapshot.accessToken).toBe('token-123')
    expect(snapshot.scopes).toEqual(['scope:a', 'scope:b'])
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
})
