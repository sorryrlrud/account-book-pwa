import { afterEach, describe, expect, it } from 'vitest'
import { AccountHintStore } from './accountHintStore.ts'

const env = { googleClientId: 'hint-client', bootstrapSpreadsheetId: 'hint-sheet' }

afterEach(() => window.localStorage.clear())

describe('AccountHintStore', () => {
  it('isolates account preferences by OAuth client and workbook', () => {
    new AccountHintStore(env).set('account-subject')

    expect(new AccountHintStore(env).get()).toBe('account-subject')
    expect(new AccountHintStore({ ...env, googleClientId: 'other-client' }).get()).toBeUndefined()
    expect(new AccountHintStore({ ...env, bootstrapSpreadsheetId: 'other-sheet' }).get()).toBeUndefined()

    new AccountHintStore(env).clear()
    expect(new AccountHintStore(env).get()).toBeUndefined()
  })

  it('keeps working when browser storage is unavailable', () => {
    const blocked = () => { throw new Error('Storage blocked') }
    const store = new AccountHintStore(env, { getItem: blocked, setItem: blocked, removeItem: blocked })

    store.set('account-subject')
    expect(store.get()).toBe('account-subject')
    store.clear()
    expect(store.get()).toBeUndefined()
  })
})
