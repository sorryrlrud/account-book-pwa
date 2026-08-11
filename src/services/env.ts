import { AppError } from '@/domain/errors.ts'

export interface AppEnv {
  googleClientId: string
  bootstrapSpreadsheetId: string
}

export function readAppEnv(env = import.meta.env): AppEnv {
  const googleClientId = env.VITE_GOOGLE_CLIENT_ID?.trim()
  const bootstrapSpreadsheetId = env.VITE_BOOTSTRAP_SPREADSHEET_ID?.trim()
  if (!googleClientId || !bootstrapSpreadsheetId) {
    throw new AppError(
      'CONFIG_MISSING',
      '앱 설정이 올바르지 않습니다. 환경설정을 확인해주세요.',
    )
  }

  return {
    googleClientId,
    bootstrapSpreadsheetId,
  }
}
