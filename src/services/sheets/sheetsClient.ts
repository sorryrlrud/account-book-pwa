import { AppError } from '@/domain/errors.ts'

export interface SheetsValueRange {
  range?: string
  majorDimension?: string
  values?: string[][]
}

export interface SheetsSpreadsheet {
  spreadsheetId: string
  properties?: {
    title?: string
  }
  sheets?: Array<{
    properties?: {
      sheetId?: number
      title?: string
      hidden?: boolean
    }
  }>
}

export interface AppendValuesResponse {
  updates?: {
    updatedRange?: string
    updatedRows?: number
  }
}

export interface SheetsClientOptions {
  fetchImpl?: typeof fetch
  getAccessToken: () => string
  maxReadRetries?: number
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

export class SheetsClient {
  readonly #fetchImpl: typeof fetch
  readonly #getAccessToken: () => string
  readonly #maxReadRetries: number

  constructor(options: SheetsClientOptions) {
    this.#fetchImpl = options.fetchImpl ?? fetch
    this.#getAccessToken = options.getAccessToken
    this.#maxReadRetries = options.maxReadRetries ?? 2
  }

  async getSpreadsheet(spreadsheetId: string): Promise<SheetsSpreadsheet> {
    return this.#requestJson<SheetsSpreadsheet>(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title,hidden)`,
      { method: 'GET' },
      true,
    )
  }

  async getValues(spreadsheetId: string, range: string): Promise<SheetsValueRange> {
    return this.#requestJson<SheetsValueRange>(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { method: 'GET' },
      true,
    )
  }

  async batchGetValues(spreadsheetId: string, ranges: string[]): Promise<{
    valueRanges: SheetsValueRange[]
  }> {
    const query = ranges.map((range) => `ranges=${encodeURIComponent(range)}`).join('&')
    return this.#requestJson<{ valueRanges: SheetsValueRange[] }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}`,
      { method: 'GET' },
      true,
    )
  }

  async appendValues(
    spreadsheetId: string,
    range: string,
    values: string[][],
  ): Promise<AppendValuesResponse> {
    return this.#requestJson<AppendValuesResponse>(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        body: JSON.stringify({
          majorDimension: 'ROWS',
          values,
        }),
      },
      false,
    )
  }

  async updateValues(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    await this.#requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        body: JSON.stringify({
          majorDimension: 'ROWS',
          values,
        }),
      },
      false,
    )
  }

  async batchUpdateValues(
    spreadsheetId: string,
    data: Array<{ range: string; values: string[][] }>,
  ): Promise<void> {
    await this.#requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data,
        }),
      },
      false,
    )
  }

  async batchUpdate(spreadsheetId: string, requests: unknown[]): Promise<void> {
    await this.#requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({ requests }),
      },
      false,
    )
  }

  async clearValues(spreadsheetId: string, range: string): Promise<void> {
    await this.#requestJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
      { method: 'POST' },
      false,
    )
  }

  async #requestJson<T = void>(
    url: string,
    init: RequestInit,
    allowReadRetry: boolean,
  ): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${this.#getAccessToken()}`)
    if (init.body) {
      headers.set('Content-Type', 'application/json')
    }

    let lastError: unknown
    const attempts = allowReadRetry ? this.#maxReadRetries + 1 : 1
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.#fetchImpl(url, {
          ...init,
          headers,
        })

        if (!response.ok) {
          const payload = await response.text()
          if (allowReadRetry && attempt < attempts - 1 && isRetryableStatus(response.status)) {
            lastError = new AppError('NETWORK_ERROR', 'Google Sheet를 다시 불러오는 중입니다.', {
              details: {
                status: response.status,
                payload,
              },
            })
            continue
          }

          throw new AppError(
            response.status === 401 ? 'AUTH_EXPIRED' : 'GOOGLE_API_ERROR',
            response.status === 401
              ? 'Google 인증이 만료되었습니다. 다시 로그인해주세요.'
              : 'Google Sheet 요청을 처리하지 못했습니다.',
            {
              details: {
                status: response.status,
                payload,
              },
            },
          )
        }

        if (response.status === 204) {
          return undefined as T
        }

        return (await response.json()) as T
      } catch (error) {
        if (error instanceof AppError) {
          if (allowReadRetry && error.code === 'NETWORK_ERROR' && attempt < attempts - 1) {
            lastError = error
            continue
          }

          throw error
        }

        lastError = error
        if (!allowReadRetry || attempt >= attempts - 1) {
          break
        }
      }
    }

    if (lastError instanceof AppError) {
      throw lastError
    }

    throw new AppError('NETWORK_ERROR', '네트워크 상태를 확인하고 다시 시도해주세요.', {
      cause: lastError,
    })
  }
}
