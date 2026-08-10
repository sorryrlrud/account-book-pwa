import { AppError } from '@/domain/errors.ts'

export interface AccessTokenSnapshot {
  accessToken: string
  expiresAt: number
  scopes: string[]
  email?: string
}

export interface TokenStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface BrowserTokenStoreOptions {
  storage?: TokenStorage
  storageKey?: string
}

const DEFAULT_STORAGE_KEY = 'account-book.google-access-token'

function getSessionStorage(): TokenStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage
  } catch {
    return undefined
  }
}

function parseSnapshot(value: string | null): AccessTokenSnapshot | undefined {
  if (!value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value) as Partial<AccessTokenSnapshot>
    if (
      typeof parsed.accessToken !== 'string' ||
      !parsed.accessToken ||
      typeof parsed.expiresAt !== 'number' ||
      !Array.isArray(parsed.scopes) ||
      !parsed.scopes.every((scope) => typeof scope === 'string')
    ) {
      return undefined
    }

    return {
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresAt,
      scopes: parsed.scopes,
      ...(typeof parsed.email === 'string' ? { email: parsed.email } : {}),
    }
  } catch {
    return undefined
  }
}

export class InMemoryTokenStore {
  #snapshot?: AccessTokenSnapshot
  readonly #storage?: TokenStorage
  readonly #storageKey: string

  constructor(options: BrowserTokenStoreOptions = {}) {
    this.#storage = options.storage ?? getSessionStorage()
    this.#storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY

    try {
      this.#snapshot = parseSnapshot(this.#storage?.getItem(this.#storageKey) ?? null)
      if (!this.#snapshot) {
        this.#storage?.removeItem(this.#storageKey)
      }
    } catch {
      // Safari private browsing and restrictive storage policies may reject
      // storage access. The in-memory fallback still supports the current page.
    }
  }

  set(snapshot: AccessTokenSnapshot): void {
    this.#snapshot = snapshot
    try {
      this.#storage?.setItem(this.#storageKey, JSON.stringify(snapshot))
    } catch {
      // Keep the in-memory token when session storage is unavailable.
    }
  }

  clear(): void {
    this.#snapshot = undefined
    try {
      this.#storage?.removeItem(this.#storageKey)
    } catch {
      // Clearing the in-memory copy is sufficient for this page lifetime.
    }
  }

  get(): AccessTokenSnapshot | undefined {
    return this.#snapshot
  }

  requireValidToken(now = Date.now()): AccessTokenSnapshot {
    if (!this.#snapshot) {
      throw new AppError('AUTH_REQUIRED', 'Google 로그인이 필요합니다.')
    }

    if (this.#snapshot.expiresAt <= now) {
      throw new AppError('AUTH_EXPIRED', 'Google 인증이 만료되었습니다. 다시 로그인해주세요.')
    }

    return this.#snapshot
  }
}
