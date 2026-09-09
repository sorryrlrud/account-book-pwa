import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppServiceContext, type AppService } from '@/app/app-service-core.ts'
import { AuthGate } from './auth-gate.tsx'

function createService(
  status: AppService['auth']['status'],
): AppService {
  return {
    isConfigured: true,
    statusLabel: '로그인 필요',
    auth: {
      status,
      message: 'Google 인증이 필요합니다.',
      isBusy: false,
      isAuthenticated: false,
      canRead: false,
      canWrite: false,
      requiresLogin: status !== 'network_error',
    },
    currentYear: 2026,
    currentMonth: 8,
    hasWriteAccess: false,
    login: vi.fn().mockResolvedValue(undefined),
    relogin: vi.fn().mockResolvedValue(undefined),
    bootstrap: vi.fn().mockResolvedValue(undefined),
  } as unknown as AppService
}

function renderGate(service: AppService) {
  render(
    <AppServiceContext.Provider value={service}>
      <AuthGate><p>가계부</p></AuthGate>
    </AppServiceContext.Provider>,
  )
}

describe('AuthGate', () => {
  it('reuses the approved account when a token expires', async () => {
    const user = userEvent.setup()
    const service = createService('auth_expired')
    renderGate(service)

    await user.click(screen.getByRole('button', { name: '다시 로그인' }))

    expect(service.login).toHaveBeenCalledOnce()
    expect(service.relogin).not.toHaveBeenCalled()
  })

  it('uses account selection as the primary action after access is denied', async () => {
    const user = userEvent.setup()
    const service = createService('access_denied')
    renderGate(service)

    await user.click(screen.getByRole('button', { name: '다른 계정으로 로그인' }))

    expect(service.relogin).toHaveBeenCalledOnce()
    expect(service.login).not.toHaveBeenCalled()
  })

  it('lets the user bypass a remembered account while signed out', async () => {
    const user = userEvent.setup()
    const service = createService('signed_out')
    renderGate(service)

    await user.click(screen.getByRole('button', { name: '다른 계정으로 로그인' }))

    expect(service.relogin).toHaveBeenCalledOnce()
    expect(service.login).not.toHaveBeenCalled()
  })

  it('disables both login actions while restoring a stored session', () => {
    const service = createService('bootstrapping')
    service.auth.isBusy = true
    renderGate(service)

    expect(screen.getByRole('button', { name: '확인 중...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다른 계정으로 로그인' })).toBeDisabled()
  })

  it('retries Sheet bootstrap without reopening Google after a network error', async () => {
    const user = userEvent.setup()
    const service = createService('network_error')
    renderGate(service)

    await user.click(screen.getByRole('button', { name: '연결 다시 시도' }))

    expect(service.bootstrap).toHaveBeenCalledOnce()
    expect(service.login).not.toHaveBeenCalled()
    expect(service.relogin).not.toHaveBeenCalled()
  })
})
