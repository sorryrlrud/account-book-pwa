import { describe, expect, it } from 'vitest'
import { InMemoryTokenStore } from './tokenStore.ts'

class TestStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

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

  it('restores a token from session storage after a page reload', () => {
    const storage = new TestStorage()
    const firstPageStore = new InMemoryTokenStore({
      storage,
      storageKey: 'test-token',
    })
    const snapshot = {
      accessToken: 'restored-token',
      expiresAt: 10_000,
      scopes: ['scope:a'],
    }

    firstPageStore.set(snapshot)

    const reloadedPageStore = new InMemoryTokenStore({
      storage,
      storageKey: 'test-token',
    })
    expect(reloadedPageStore.get()).toEqual(snapshot)

    reloadedPageStore.clear()
    expect(storage.getItem('test-token')).toBeNull()
  })

  it('ignores malformed session storage without breaking login', () => {
    const storage = new TestStorage()
    storage.setItem('test-token', '{broken')

    const store = new InMemoryTokenStore({
      storage,
      storageKey: 'test-token',
    })

    expect(store.get()).toBeUndefined()
    expect(storage.getItem('test-token')).toBeNull()
  })
})
