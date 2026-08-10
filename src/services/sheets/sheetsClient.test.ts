import { describe, expect, it, vi } from 'vitest'
import { SheetsClient } from './sheetsClient.ts'
import { jsonResponse, textResponse } from '../../../tests/fixtures/googleApi.ts'

function createClient(
  fetchImpl: typeof fetch,
  maxReadRetries = 2,
): SheetsClient {
  return new SheetsClient({
    fetchImpl,
    getAccessToken: () => 'sheet-token',
    maxReadRetries,
  })
}

describe('SheetsClient', () => {
  it('sends authorization headers for reads', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ values: [['ok']] }),
    )

    const client = createClient(fetchImpl)
    const response = await client.getValues('spreadsheet-id', "'8'!A:Z")

    expect(response.values).toEqual([['ok']])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
    })

    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers)
    expect(headers.get('Authorization')).toBe('Bearer sheet-token')
  })

  it('retries retryable read failures and eventually succeeds', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse('temporary', 500))
      .mockResolvedValueOnce(textResponse('still temporary', 429))
      .mockResolvedValueOnce(jsonResponse({ values: [['done']] }))

    const client = createClient(fetchImpl, 2)
    const response = await client.getValues('spreadsheet-id', "'8'!A:Z")

    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(response.values).toEqual([['done']])
  })

  it('does not retry writes after a failure', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(textResponse('append failed', 500))

    const client = createClient(fetchImpl)

    await expect(
      client.appendValues('spreadsheet-id', "'8'!A:Z", [['2026-08-10']]),
    ).rejects.toMatchObject({
      code: 'GOOGLE_API_ERROR',
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('maps 401 responses to AUTH_EXPIRED', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      textResponse('expired', 401),
    )

    const client = createClient(fetchImpl)

    await expect(client.getSpreadsheet('spreadsheet-id')).rejects.toMatchObject({
      code: 'AUTH_EXPIRED',
    })
  })

  it('treats 403 responses as Google API errors without retrying endlessly', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      textResponse('forbidden', 403),
    )

    const client = createClient(fetchImpl, 3)

    await expect(client.getValues('spreadsheet-id', "'앱설정'!A:B")).rejects.toMatchObject({
      code: 'GOOGLE_API_ERROR',
      details: {
        status: 403,
      },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('surfaces final network failures as NETWORK_ERROR', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('socket closed'))

    const client = createClient(fetchImpl, 1)

    await expect(client.getValues('spreadsheet-id', "'8'!A:Z")).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('supports 204 responses for mutation requests', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    const client = createClient(fetchImpl)

    await expect(
      client.updateValues('spreadsheet-id', "'8'!A:Z", [['updated']]),
    ).resolves.toBeUndefined()
  })
})
