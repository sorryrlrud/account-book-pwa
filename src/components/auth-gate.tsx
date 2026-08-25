import { useState, type ReactNode } from 'react'
import { useAppService } from '@/app/use-app-service.ts'

export function AuthGate({ children }: { children: ReactNode }) {
  const service = useAppService()
  const { auth } = service
  const [actionError, setActionError] = useState('')

  const runAction = async (action: () => Promise<void>) => {
    setActionError('')
    try {
      await action()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : '요청을 완료하지 못했습니다.',
      )
    }
  }

  const isConfigured = auth.status !== 'unconfigured'
  const isAccessDenied = auth.status === 'access_denied'
  const isExpired = auth.status === 'auth_expired'
  const isNetworkError = auth.status === 'network_error'
  const buttonLabel = isAccessDenied
    ? '다른 계정으로 로그인'
    : isExpired
      ? '다시 로그인'
      : isNetworkError
        ? '연결 다시 시도'
        : 'Google로 로그인'

  const gate = (
    <main className="auth-gate">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="app-header__eyebrow">ACCOUNT BOOK</p>
        <h1 id="auth-title">모바일 가계부</h1>
        <p className="auth-card__message" role="status" aria-live="polite">
          {isAccessDenied
            ? '이 Google 계정에는 가계부 접근 권한이 없습니다.'
            : auth.message}
        </p>

        {auth.status === 'unconfigured' ? (
          <div className="auth-card__setup">
            <p>배포 환경에 다음 Repository Variables를 설정해주세요.</p>
            <code>VITE_GOOGLE_CLIENT_ID</code>
            <code>VITE_BOOTSTRAP_SPREADSHEET_ID</code>
          </div>
        ) : null}

        {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}

        {isConfigured ? (
          <button
            type="button"
            className="primary-button auth-card__button"
            disabled={auth.isBusy}
            onClick={() => {
              void runAction(
                isNetworkError
                  ? () => service.bootstrap()
                  : isAccessDenied
                    ? () => service.relogin()
                    : () => service.login(),
              )
            }}
          >
            {auth.isBusy ? '확인 중...' : buttonLabel}
          </button>
        ) : null}

        <p className="auth-card__safety">
          저장한 거래는 연결된 Google Sheet에 바로 반영됩니다.
        </p>
      </section>
    </main>
  )

  return auth.status === 'ready' ? children : gate
}
