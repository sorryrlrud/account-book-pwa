import { CONTROL_STYLE } from '@/features/readViews/formatters'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import type {
  EditableAccount,
  EditableCategory,
  SettingsYearLinkDraft,
  SettingsYearLinkItem,
  SyncConfirmation,
} from '@/features/settings/types'

export interface SettingsPageProps {
  newAccountName: string
  newCategoryName: string
  accounts: EditableAccount[]
  categories: EditableCategory[]
  yearLinks: SettingsYearLinkItem[]
  yearLinkDraft: SettingsYearLinkDraft
  syncConfirmation?: SyncConfirmation
  onNewAccountNameChange: (name: string) => void
  onAccountDraftNameChange: (accountName: string, draftName: string) => void
  onAccountCreate: () => void
  onAccountDisableToggle: (accountName: string, active: boolean) => void
  onAccountRename: (accountName: string) => void
  onNewCategoryNameChange: (name: string) => void
  onCategoryDraftNameChange: (categoryName: string, draftName: string) => void
  onCategoryCreate: () => void
  onCategoryDisableToggle: (categoryName: string, active: boolean) => void
  onCategoryRename: (categoryName: string) => void
  onYearLinkDraftChange: (draft: SettingsYearLinkDraft) => void
  onYearLinkSubmit: () => void
  onRequestMonthZeroSync: () => void
  onOpenSheet: (year: number) => void
  onLogout: () => void
}

function renderSyncConfirmation(syncConfirmation?: SyncConfirmation) {
  if (!syncConfirmation?.open) {
    return null
  }

  return (
    <section
      className="settings-page__confirmation"
      role="dialog"
      aria-labelledby="settings-sync-title"
      style={{ border: '1px solid currentColor', borderRadius: '16px', padding: '16px' }}
    >
      <h2 id="settings-sync-title" style={{ marginTop: 0 }}>
        {syncConfirmation.title}
      </h2>
      <p>{syncConfirmation.description}</p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={syncConfirmation.onConfirm} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
          {syncConfirmation.confirmLabel}
        </button>
        <button type="button" onClick={syncConfirmation.onCancel} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
          {syncConfirmation.cancelLabel ?? '취소'}
        </button>
      </div>
    </section>
  )
}

export default function SettingsPage({
  newAccountName,
  newCategoryName,
  accounts,
  categories,
  yearLinks,
  yearLinkDraft,
  syncConfirmation,
  onNewAccountNameChange,
  onAccountDraftNameChange,
  onAccountCreate,
  onAccountDisableToggle,
  onAccountRename,
  onNewCategoryNameChange,
  onCategoryDraftNameChange,
  onCategoryCreate,
  onCategoryDisableToggle,
  onCategoryRename,
  onYearLinkDraftChange,
  onYearLinkSubmit,
  onRequestMonthZeroSync,
  onOpenSheet,
  onLogout,
}: SettingsPageProps) {
  return (
    <section className="settings-page" style={{ display: 'grid', gap: '16px' }}>
      <header className="settings-page__header" style={{ display: 'grid', gap: '12px' }}>
        <div>
          <p className="settings-page__eyebrow" style={{ margin: 0 }}>
            설정
          </p>
          <h1 className="settings-page__title" style={{ margin: '8px 0 0' }}>
            계정 및 기준 정보
          </h1>
        </div>
        <div className="settings-page__account-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onLogout} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
            로그아웃
          </button>
        </div>
        <p className="settings-page__account-email" style={{ margin: 0 }}>
          Google 계정 연결 상태: 연결됨
        </p>
      </header>

      <SettingsSection title="통장 관리" description="새 통장을 추가하고 이름 변경 또는 사용 여부를 조정합니다.">
        <div className="settings-page__accounts" style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span>새 통장 이름</span>
              <input
                type="text"
                value={newAccountName}
                onChange={(event) => onNewAccountNameChange(event.target.value)}
                style={CONTROL_STYLE}
              />
            </label>
            <button type="button" onClick={onAccountCreate} disabled={!newAccountName.trim()} style={{ ...CONTROL_STYLE, alignSelf: 'end' }}>
              추가
            </button>
          </div>
          {accounts.map((account) => (
            <article key={account.name} className="settings-page__account-row" style={{ display: 'grid', gap: '8px' }}>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span>{account.name}</span>
                <input
                  type="text"
                  value={account.draftName}
                  onChange={(event) => onAccountDraftNameChange(account.name, event.target.value)}
                  className="settings-page__input settings-page__input--account"
                  style={CONTROL_STYLE}
                />
              </label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onAccountRename(account.name)} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
                  이름 변경
                </button>
                <button
                  type="button"
                  onClick={() => onAccountDisableToggle(account.name, !account.active)}
                  disabled={!account.active}
                  style={{ ...CONTROL_STYLE, minWidth: '120px' }}
                >
                  {account.active ? '사용중지' : '사용중지됨'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="카테고리 관리" description="카테고리를 추가하고 이름 변경 또는 사용 여부를 조정합니다.">
        <div className="settings-page__categories" style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span>새 카테고리 이름</span>
              <input
                type="text"
                value={newCategoryName}
                onChange={(event) => onNewCategoryNameChange(event.target.value)}
                style={CONTROL_STYLE}
              />
            </label>
            <button type="button" onClick={onCategoryCreate} disabled={!newCategoryName.trim()} style={{ ...CONTROL_STYLE, alignSelf: 'end' }}>
              추가
            </button>
          </div>
          {categories.map((category) => (
            <article key={category.name} className="settings-page__category-row" style={{ display: 'grid', gap: '8px' }}>
              <label style={{ display: 'grid', gap: '6px' }}>
                <span>{category.name}</span>
                <input
                  type="text"
                  value={category.draftName}
                  onChange={(event) => onCategoryDraftNameChange(category.name, event.target.value)}
                  className="settings-page__input settings-page__input--category"
                  style={CONTROL_STYLE}
                />
              </label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onCategoryRename(category.name)} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
                  이름 변경
                </button>
                <button
                  type="button"
                  onClick={() => onCategoryDisableToggle(category.name, !category.active)}
                  disabled={!category.active}
                  style={{ ...CONTROL_STYLE, minWidth: '120px' }}
                >
                  {category.active ? '사용중지' : '사용중지됨'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="연도 연결" description="연도별 시트를 등록하고 바로 열 수 있습니다.">
        <div className="settings-page__years" style={{ display: 'grid', gap: '12px' }}>
          <div className="settings-page__year-form" style={{ display: 'grid', gap: '8px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span>연도</span>
              <input
                type="text"
                inputMode="numeric"
                value={yearLinkDraft.year}
                onChange={(event) =>
                  onYearLinkDraftChange({
                    ...yearLinkDraft,
                    year: event.target.value,
                  })
                }
                className="settings-page__input settings-page__input--year"
                style={CONTROL_STYLE}
              />
            </label>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span>시트 URL</span>
              <input
                type="url"
                value={yearLinkDraft.spreadsheetUrl}
                onChange={(event) =>
                  onYearLinkDraftChange({
                    ...yearLinkDraft,
                    spreadsheetUrl: event.target.value,
                  })
                }
                className="settings-page__input settings-page__input--url"
                style={CONTROL_STYLE}
              />
            </label>
            <button type="button" onClick={onYearLinkSubmit} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
              연도 연결 저장
            </button>
          </div>
          <ul className="settings-page__year-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '10px' }}>
            {yearLinks.map((yearLink) => (
              <li
                key={yearLink.year}
                className="settings-page__year-item"
                style={{ border: '1px solid currentColor', borderRadius: '12px', padding: '12px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{yearLink.year}년</strong>
                    <p style={{ margin: '6px 0 0' }}>{yearLink.connected ? '연결됨' : '미연결'}</p>
                  </div>
                  <button type="button" onClick={() => onOpenSheet(yearLink.year)} style={{ ...CONTROL_STYLE, minWidth: '120px' }}>
                    시트 열기
                  </button>
                </div>
                {yearLink.spreadsheetUrl ? <p style={{ margin: '8px 0 0' }}>{yearLink.spreadsheetUrl}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </SettingsSection>

      <SettingsSection
        title="월 0 동기화"
        description="월 0은 일방향 동기화입니다. 실행하면 기준 시트의 값으로 덮어쓰므로 확인이 필요합니다."
      >
        <div className="settings-page__sync" style={{ display: 'grid', gap: '12px' }}>
          <p className="settings-page__sync-warning" style={{ margin: 0, color: '#9a3412' }}>
            월 0 동기화는 되돌릴 수 없습니다.
          </p>
          <button type="button" onClick={onRequestMonthZeroSync} style={{ ...CONTROL_STYLE, minWidth: '160px' }}>
            월 0 동기화 확인
          </button>
        </div>
      </SettingsSection>

      {renderSyncConfirmation(syncConfirmation)}
    </section>
  )
}
