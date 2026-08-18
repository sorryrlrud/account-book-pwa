import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAppService } from '@/app/use-app-service.ts'
import { refreshToLatestVersion } from '@/app/refresh-app.ts'

const MENU_ITEMS = [
  { label: '정산', to: '/settlement' },
  { label: '투자', to: '/investment' },
  { label: '에너지', to: '/energy' },
  { label: '설정', to: '/settings' },
] as const

const BOTTOM_ITEMS = [
  { label: '입력', to: '/entry' },
  { label: '내역', to: '/history' },
  { label: '예산', to: '/budget' },
] as const

export function AppShell() {
  const service = useAppService()
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setActionError('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  const closeMenu = () => {
    setMenuOpen(false)
    setActionError('')
  }

  const handleLogout = async () => {
    try {
      setActionError('')
      await service.logout()
      closeMenu()
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : '로그아웃 중 오류가 발생했습니다.',
      )
    }
  }

  const handleRefresh = async () => {
    try {
      setActionError('')
      setIsRefreshing(true)
      await refreshToLatestVersion()
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : '최신 버전을 확인하는 중 오류가 발생했습니다.',
      )
      setIsRefreshing(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <header className="app-header">
          <div>
            <p className="app-header__eyebrow">ACCOUNT BOOK</p>
            <div className="app-header__title-row">
              <h1 className="app-header__title">모바일 가계부</h1>
              <span className="app-header__version">{__APP_VERSION__}</span>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-expanded={menuOpen}
            aria-controls="app-menu-panel"
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span className="icon-button__emoji" aria-hidden="true">
              {menuOpen ? '✖️' : '☰️'}
            </span>
          </button>
        </header>

        <nav className="primary-tabs" aria-label="주요 페이지">
          {BOTTOM_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `primary-tabs__link${isActive ? ' is-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <aside
        id="app-menu-panel"
        className={`menu-panel${menuOpen ? ' is-open' : ''}`}
        aria-hidden={!menuOpen}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-menu-title"
      >
        <div className="menu-panel__card">
          <div className="menu-panel__header">
            <h2 id="app-menu-title">메뉴</h2>
            <button
              type="button"
              className="text-button"
              onClick={closeMenu}
              aria-label="메뉴 닫기"
            >
              닫기
            </button>
          </div>
          <nav aria-label="상단 메뉴">
            <ul className="menu-list">
              {MENU_ITEMS.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `menu-link${isActive ? ' is-active' : ''}`
                    }
                    onClick={closeMenu}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="menu-link menu-link--button"
                  onClick={() => {
                    void handleRefresh()
                  }}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? '최신 버전 확인 중...' : '새 버전으로 새로고침'}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="menu-link menu-link--button"
                  onClick={() => {
                    service.openGoogleSheet()
                    closeMenu()
                  }}
                >
                  Google Sheet 열기
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="menu-link menu-link--button"
                  onClick={() => {
                    void handleLogout()
                  }}
                >
                  로그아웃
                </button>
              </li>
            </ul>
          </nav>
          {actionError ? <p className="form-error">{actionError}</p> : null}
        </div>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          className="menu-backdrop"
          aria-label="메뉴 닫기"
          onClick={closeMenu}
        />
      ) : null}

      <main className="app-main" key={location.pathname}>
        <Outlet />
      </main>

    </div>
  )
}
