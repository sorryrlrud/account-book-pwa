export type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'ACCESS_DENIED'
  | 'CONFIG_MISSING'
  | 'INVALID_CONFIG'
  | 'SCHEMA_MISMATCH'
  | 'UNSUPPORTED_SCHEMA'
  | 'NETWORK_ERROR'
  | 'WRITE_GUARD'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'TRANSFER_INTEGRITY'
  | 'GOOGLE_API_ERROR'
  | 'UNAVAILABLE'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly userMessage: string
  readonly cause?: unknown
  readonly details?: Record<string, unknown>

  constructor(
    code: AppErrorCode,
    userMessage: string,
    options?: {
      cause?: unknown
      details?: Record<string, unknown>
    },
  ) {
    super(userMessage)
    this.name = 'AppError'
    this.code = code
    this.userMessage = userMessage
    this.cause = options?.cause
    this.details = options?.details
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function toAppError(
  error: unknown,
  fallback: Pick<AppError, 'code' | 'userMessage'>,
): AppError {
  if (isAppError(error)) {
    return error
  }

  return new AppError(fallback.code, fallback.userMessage, {
    cause: error,
  })
}
