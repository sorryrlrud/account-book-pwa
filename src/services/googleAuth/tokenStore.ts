import { AppError } from '@/domain/errors.ts'

export interface AccessTokenSnapshot {
  accessToken: string
  expiresAt: number
  scopes: string[]
  email?: string
}

export class InMemoryTokenStore {
  #snapshot?: AccessTokenSnapshot

  set(snapshot: AccessTokenSnapshot): void {
    this.#snapshot = snapshot
  }

  clear(): void {
    this.#snapshot = undefined
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
