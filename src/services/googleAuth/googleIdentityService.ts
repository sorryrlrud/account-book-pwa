import { AppError } from '@/domain/errors.ts'
import type { AppEnv } from '@/services/env.ts'
import { AccountHintStore } from '@/services/googleAuth/accountHintStore.ts'
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
    error_callback?: (error: {
      type?: 'popup_failed_to_open' | 'popup_closed' | 'unknown' | string
    }) => void
    prompt?: string
    login_hint?: string
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
  accountHintStore?: AccountHintStore
  windowRef?: GoogleIdentityWindow
}

const DEFAULT_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

export class GoogleIdentityService {
  readonly #env: AppEnv
  readonly #tokenStore: InMemoryTokenStore
  readonly #accountHintStore: AccountHintStore
  readonly #windowRef: GoogleIdentityWindow
  #pendingRequest?: Promise<AccessTokenSnapshot>
  #accountVersion = 0

  constructor(options: GoogleIdentityServiceOptions) {
    this.#env = options.env
    this.#tokenStore = options.tokenStore ?? new InMemoryTokenStore()
    this.#accountHintStore = options.accountHintStore ?? new AccountHintStore(options.env)
    this.#windowRef = options.windowRef ?? (window as GoogleIdentityWindow)
  }

  get tokenStore(): InMemoryTokenStore {
    return this.#tokenStore
  }

  forgetAccount(): void {
    this.#accountVersion += 1
    this.#accountHintStore.clear()
  }

  getReusableToken(scopes: string[] = [DEFAULT_SHEETS_SCOPE]): AccessTokenSnapshot | undefined {
    return this.#tokenStore.getValidToken(scopes, Date.now() + 60_000)
  }

  async requestAccessToken(
    scopes: string[] = [DEFAULT_SHEETS_SCOPE],
    prompt: '' | 'consent' | 'select_account' = '',
  ): Promise<AccessTokenSnapshot> {
    if (this.#pendingRequest) {
      return this.#pendingRequest
    }

    // An existing Sheets grant remains usable without requesting the newly
    // added account hint scope. Obtain that scope at the next real reconnect.
    const existing = this.getReusableToken(scopes)
    if (prompt === '' && existing) {
      return existing
    }

    if (prompt === 'select_account') {
      this.forgetAccount()
    }

    const oauth2 = this.#windowRef.google?.accounts?.oauth2
    if (!oauth2) {
      throw new AppError('UNAVAILABLE', 'Google 인증 모듈을 불러오지 못했습니다.')
    }

    const requestedScopes = [...new Set([...scopes, 'openid'])]
    const loginHint = this.#accountHintStore.get()
    const request = new Promise<AccessTokenSnapshot>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: this.#env.googleClientId,
        scope: requestedScopes.join(' '),
        prompt,
        ...(loginHint ? { login_hint: loginHint } : {}),
        callback: (response) => {
          if (
            response.error ||
            !response.access_token ||
            !Number.isFinite(response.expires_in) ||
            !response.expires_in ||
            response.expires_in <= 0
          ) {
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
            scopes: response.scope?.split(' ').filter(Boolean) ?? requestedScopes,
          }

          this.#tokenStore.set(snapshot)
          this.forgetAccount()
          void this.#rememberAccount(snapshot)
          resolve(snapshot)
        },
        error_callback: (error) => {
          const popupClosed = error.type === 'popup_closed'
          reject(
            new AppError(
              popupClosed ? 'AUTH_REQUIRED' : 'UNAVAILABLE',
              popupClosed
                ? 'Google 로그인 창이 닫혔습니다. 다시 시도해주세요.'
                : 'Google 로그인 창을 열지 못했습니다. 팝업 차단 설정을 확인해주세요.',
              { details: { oauthErrorType: error.type ?? 'unknown' } },
            ),
          )
        },
      })

      client.requestAccessToken({ prompt })
    })

    this.#pendingRequest = request
    try {
      return await request
    } finally {
      this.#pendingRequest = undefined
    }
  }

  async #rememberAccount(snapshot: AccessTokenSnapshot): Promise<void> {
    if (!snapshot.scopes.includes('openid')) {
      return
    }

    const accountVersion = this.#accountVersion
    try {
      const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${snapshot.accessToken}` },
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
      })
      if (!response.ok) {
        return
      }
      const profile = await response.json() as { sub?: unknown }
      if (
        this.#tokenStore.get() === snapshot &&
        this.#accountVersion === accountVersion &&
        typeof profile.sub === 'string' &&
        profile.sub.length > 0 &&
        profile.sub.length <= 255
      ) {
        this.#accountHintStore.set(profile.sub)
      }
    } catch {
      // Account selection is an optional convenience. A failed profile read
      // must not discard a valid token or block access to the ledger.
    }
  }
}
