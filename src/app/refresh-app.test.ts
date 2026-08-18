import { describe, expect, it, vi } from 'vitest'
import { createLatestVersionUrl, getLatestBuildVersion } from './refresh-app.ts'

describe('PWA refresh', () => {
  it('requests the uncached build version', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ version: 'v260818.205500' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(getLatestBuildVersion(fetcher)).resolves.toBe('v260818.205500')
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/version.json' }),
      { cache: 'no-store' },
    )
  })

  it('adds the latest version before the hash route', () => {
    expect(
      createLatestVersionUrl(
        'https://sorryrlrud.github.io/account-book-pwa/#/budget',
        'v260818.205500',
      ),
    ).toBe(
      'https://sorryrlrud.github.io/account-book-pwa/?version=v260818.205500#/budget',
    )
  })
})
