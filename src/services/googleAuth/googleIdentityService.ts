import { AppError } from '@/domain/errors.ts'
import type { AppEnv } from '@/services/env.ts'
import {
  InMemoryTokenStore,
  type AccessTokenSnapshot,
} from '@/services/googleAuth/tokenStore.ts'

interface GoogleAccountsOauth2 {
  initTokenClient(config: {
    client_id: string
    scope: string
    callback: (response: {
      access_token?: string
      expires_in?: number
      error?: string
      error_description?: string
      scope?: string
    }) => void
    prompt?: string
  }): {
    requestAccessToken: (override?: { prompt?: string }) => void
  }
}

interface GoogleIdentityWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: GoogleAccountsOauth2
    }
  }
}

export interface GoogleIdentityServiceOptions {
  env: AppEnv
  tokenStore?: InMemoryTokenStore
  windowRef?: GoogleIdentityWindow
}

const DEFAULT_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

export class GoogleIdentityService {
  readonly #env: AppEnv
  readonly #tokenStore: InMemoryTokenStore
  readonly #windowRef: GoogleIdentityWindow

  constructor(options: GoogleIdentityServiceOptions) {
    this.#env = options.env
    this.#tokenStore = options.tokenStore ?? new InMemoryTokenStore()
    this.#windowRef = options.windowRef ?? (window as GoogleIdentityWindow)
  }

  get tokenStore(): InMemoryTokenStore {
    return this.#tokenStore
  }

  async requestAccessToken(
    scopes: string[] = [DEFAULT_SHEETS_SCOPE],
    prompt: 'consent' | 'select_account' = 'consent',
  ): Promise<AccessTokenSnapshot> {
    const oauth2 = this.#windowRef.google?.accounts?.oauth2
    if (!oauth2) {
      throw new AppError('UNAVAILABLE', 'Google 인증 모듈을 불러오지 못했습니다.')
    }

    return new Promise((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: this.#env.googleClientId,
        scope: scopes.join(' '),
        callback: (response) => {
          if (response.error || !response.access_token || !response.expires_in) {
            reject(
              new AppError(
                'AUTH_REQUIRED',
                'Google 로그인을 완료하지 못했습니다.',
                { details: response },
              ),
            )
            return
          }

          const snapshot: AccessTokenSnapshot = {
            accessToken: response.access_token,
            expiresAt: Date.now() + response.expires_in * 1000,
            scopes: response.scope?.split(' ').filter(Boolean) ?? scopes,
          }

          this.#tokenStore.set(snapshot)
          resolve(snapshot)
        },
      })

      client.requestAccessToken({ prompt })
    })
  }
}
