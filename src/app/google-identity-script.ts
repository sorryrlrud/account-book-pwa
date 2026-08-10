import { AppError } from '@/domain/errors.ts'

const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services'
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let scriptPromise: Promise<void> | undefined

interface LoadGoogleIdentityScriptOptions {
  documentRef?: Document
}

interface GoogleIdentityScriptWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: unknown
    }
  }
}

export function loadGoogleIdentityScript(
  options: LoadGoogleIdentityScriptOptions = {},
): Promise<void> {
  const documentRef = options.documentRef ?? document
  const windowRef = window as GoogleIdentityScriptWindow

  if (
    typeof window !== 'undefined' &&
    windowRef.google?.accounts?.oauth2
  ) {
    return Promise.resolve()
  }

  if (scriptPromise) {
    return scriptPromise
  }

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = documentRef.getElementById(
      GOOGLE_IDENTITY_SCRIPT_ID,
    ) as HTMLScriptElement | null

    if (existingScript) {
      if (windowRef.google?.accounts?.oauth2) {
        resolve()
        return
      }

      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener(
        'error',
        () => {
          scriptPromise = undefined
          reject(
            new AppError(
              'UNAVAILABLE',
              'Google 인증 스크립트를 불러오지 못했습니다.',
            ),
          )
        },
        { once: true },
      )
      return
    }

    const script = documentRef.createElement('script')
    script.id = GOOGLE_IDENTITY_SCRIPT_ID
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (!windowRef.google?.accounts?.oauth2) {
        scriptPromise = undefined
        reject(
          new AppError(
            'UNAVAILABLE',
            'Google 인증 스크립트를 초기화하지 못했습니다.',
          ),
        )
        return
      }
      resolve()
    }
    script.onerror = () => {
      scriptPromise = undefined
      script.remove()
      reject(
        new AppError(
          'UNAVAILABLE',
          'Google 인증 스크립트를 불러오지 못했습니다.',
        ),
      )
    }

    documentRef.head.append(script)
  })

  return scriptPromise
}
