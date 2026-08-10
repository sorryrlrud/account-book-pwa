import { describe, expect, it } from 'vitest'
import { InMemoryTokenStore } from './tokenStore.ts'

describe('InMemoryTokenStore', () => {
  it('requires login before exposing a token', () => {
    const store = new InMemoryTokenStore()

    try {
      store.requireValidToken()
      throw new Error('expected requireValidToken() to throw')
    } catch (error) {
      expect(error).toMatchObject({
        code: 'AUTH_REQUIRED',
      })
    }
  })

  it('rejects expired tokens', () => {
    const store = new InMemoryTokenStore()
    store.set({
      accessToken: 'expired-token',
      expiresAt: 999,
      scopes: ['scope:a'],
    })

    try {
      store.requireValidToken(1_000)
      throw new Error('expected requireValidToken() to throw')
    } catch (error) {
      expect(error).toMatchObject({
        code: 'AUTH_EXPIRED',
      })
    }
  })

  it('returns valid tokens and clears them explicitly', () => {
    const store = new InMemoryTokenStore()
    const snapshot = {
      accessToken: 'valid-token',
      expiresAt: 10_000,
      scopes: ['scope:a'],
      email: 'user@example.com',
    }

    store.set(snapshot)

    expect(store.get()).toEqual(snapshot)
    expect(store.requireValidToken(9_999)).toEqual(snapshot)

    store.clear()

    expect(store.get()).toBeUndefined()
  })
})
