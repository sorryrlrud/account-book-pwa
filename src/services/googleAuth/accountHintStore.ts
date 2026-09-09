import type { AppEnv } from '@/services/env.ts'
import type { TokenStorage } from '@/services/googleAuth/tokenStore.ts'

function getLocalStorage(): TokenStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

// This is only an account-selection preference. It is never an access token
// or evidence of authorization; Google and Sheet access checks still apply.
export class AccountHintStore {
  readonly #storage?: TokenStorage
  readonly #key: string
  #subject?: string

  constructor(env: AppEnv, storage = getLocalStorage()) {
    this.#storage = storage
    this.#key = `account-book.google-account:${env.googleClientId}:${env.bootstrapSpreadsheetId}`
    try {
      const subject = storage?.getItem(this.#key)
      if (subject && subject.length <= 255) {
        this.#subject = subject
      }
    } catch {
      // Remember the account only for this page if storage is restricted.
    }
  }

  get(): string | undefined {
    return this.#subject
  }

  set(subject: string): void {
    this.#subject = subject
    try {
      this.#storage?.setItem(this.#key, subject)
    } catch {
      // A storage failure must not prevent login.
    }
  }

  clear(): void {
    this.#subject = undefined
    try {
      this.#storage?.removeItem(this.#key)
    } catch {
      // The current page no longer uses the remembered account.
    }
  }
}
