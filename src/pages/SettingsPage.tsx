import { SettingsSection } from '@/features/settings/components/SettingsSection'
import type {
  EditableAccount,
  EditableCategory,
  SettingsYearLinkDraft,
  SettingsYearLinkItem,
  SettingsConfirmation,
} from '@/features/settings/types'
import type { BudgetGroup } from '@/domain/budget.ts'

export interface SettingsPageProps {
  newAccountName: string
  newCategoryName: string
  newCategoryBudgetGroup: string
  newBudgetGroupName: string
  newBudgetGroupBase: string
  budgetGroups: string[]
  budgetGroupItems: BudgetGroup[]
  accounts: EditableAccount[]
  categories: EditableCategory[]
  yearLinks: SettingsYearLinkItem[]
  yearLinkDraft: SettingsYearLinkDraft
  confirmation?: SettingsConfirmation
  isBusy?: boolean
  canWrite?: boolean
  canSyncMonthZero?: boolean
  onNewAccountNameChange: (name: string) => void
  onAccountDraftNameChange: (accountName: string, draftName: string) => void
  onAccountCreate: () => void
  onAccountDisableToggle: (accountName: string, active: boolean) => void
  onAccountRename: (accountName: string) => void
  onNewCategoryNameChange: (name: string) => void
  onNewBudgetGroupNameChange: (name: string) => void
  onNewBudgetGroupBaseChange: (amount: string) => void
  onBudgetGroupCreate: () => void
  onNewCategoryBudgetGroupChange: (name: string) => void
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

function renderConfirmation(confirmation?: SettingsConfirmation, isBusy = false) {
  if (!confirmation?.open) {
    return null
  }

  return (
    <div className="confirmation-overlay">
      <section
        className={`panel confirmation-dialog settings-page__confirmation${confirmation.tone === 'danger' ? ' is-danger' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-confirmation-title"
      >
        <h3 id="settings-confirmation-title">{confirmation.title}</h3>
        <p>{confirmation.description}</p>
        <div className="confirmation-actions">
          <button
            type="button"
            className={confirmation.tone === 'danger' ? 'primary-button primary-button--danger' : 'primary-button'}
            onClick={confirmation.onConfirm}
            disabled={isBusy}
          >
            {isBusy ? '처리 중...' : confirmation.confirmLabel}
          </button>
          <button type="button" className="secondary-button" onClick={confirmation.onCancel} disabled={isBusy} autoFocus>
            {confirmation.cancelLabel ?? '취소'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function SettingsPage({
  newAccountName,
  newCategoryName,
  newCategoryBudgetGroup,
  newBudgetGroupName,
  newBudgetGroupBase,
  budgetGroups,
  budgetGroupItems,
  accounts,
  categories,
  yearLinks,
  yearLinkDraft,
  confirmation,
  isBusy = false,
  canWrite = true,
  canSyncMonthZero = true,
  onNewAccountNameChange,
  onAccountDraftNameChange,
  onAccountCreate,
  onAccountDisableToggle,
  onAccountRename,
  onNewCategoryNameChange,
  onNewBudgetGroupNameChange,
  onNewBudgetGroupBaseChange,
  onBudgetGroupCreate,
  onNewCategoryBudgetGroupChange,
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
    <section className="read-page settings-page">
      <header className="read-page__header settings-page__header">
        <div>
          <p className="read-page__eyebrow settings-page__eyebrow">
            설정
          </p>
          <h2 className="read-page__title settings-page__title">
            계정 및 기준 정보
          </h2>
        </div>
        <div className="settings-page__account-actions">
          <button type="button" className="secondary-button" onClick={onLogout} disabled={isBusy}>
            로그아웃
          </button>
        </div>
        <p className="settings-page__account-email">
          Google 계정 연결 상태: 연결됨
        </p>
      </header>

      <SettingsSection title="통장 관리" description="새 통장을 추가하고 이름을 바꾸거나 신규 거래에서 사용중지할 수 있습니다.">
        <div className="settings-page__collection">
          <div className="settings-page__category-create">
            <label className="field">
              <span>새 통장 이름</span>
              <input
                type="text"
                value={newAccountName}
                onChange={(event) => onNewAccountNameChange(event.target.value)}
                disabled={isBusy || !canWrite}
              />
            </label>
            <button type="button" className="primary-button" onClick={onAccountCreate} disabled={isBusy || !canWrite || !newAccountName.trim()}>
              추가
            </button>
          </div>
          {accounts.map((account) => (
            <article key={account.name} className={`settings-page__item${account.active ? '' : ' is-inactive'}`}>
              <label className="field">
                <span>{account.name}</span>
                <input
                  type="text"
                  value={account.draftName}
                  onChange={(event) => onAccountDraftNameChange(account.name, event.target.value)}
                  className="settings-page__input settings-page__input--account"
                  disabled={isBusy || !canWrite}
                />
              </label>
              <div className="settings-page__item-actions">
                <button type="button" className="secondary-button" onClick={() => onAccountRename(account.name)} disabled={isBusy || !canWrite || !account.draftName.trim() || account.draftName.trim() === account.name}>
                  이름 변경
                </button>
                <button
                  type="button"
                  onClick={() => onAccountDisableToggle(account.name, !account.active)}
                  className="text-button text-button--danger"
                  disabled={isBusy || !canWrite || !account.active}
                >
                  {account.active ? '사용중지' : '사용중지됨'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="예산 그룹 관리" description="그룹별 기본 월예산을 등록합니다. 월별 행은 조정을 저장할 때 앱이 자동으로 만듭니다.">
        <div className="settings-page__collection">
          <div className="settings-page__create-row">
            <label className="field">
              <span>새 예산 그룹 이름</span>
              <input
                type="text"
                value={newBudgetGroupName}
                onChange={(event) => onNewBudgetGroupNameChange(event.target.value)}
                disabled={isBusy || !canWrite}
              />
            </label>
            <label className="field">
              <span>기준 월예산</span>
              <input
                type="text"
                inputMode="numeric"
                value={newBudgetGroupBase}
                onChange={(event) => onNewBudgetGroupBaseChange(event.target.value)}
                placeholder="예: 1500000"
                disabled={isBusy || !canWrite}
              />
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={onBudgetGroupCreate}
              disabled={isBusy || !canWrite || !newBudgetGroupName.trim() || !newBudgetGroupBase.trim()}
            >
              추가
            </button>
          </div>
          {budgetGroupItems.map((group) => (
            <article key={group.name} className={`settings-page__item${group.active ? '' : ' is-inactive'}`}>
              <span>
                {group.name}
                <small className="settings-page__item-meta">
                  기준 월예산 · {group.baseMonthlyBudget.toLocaleString('ko-KR')}원
                </small>
              </span>
            </article>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="카테고리 관리" description="카테고리를 추가하고 이름을 바꾸거나 신규 거래에서 사용중지할 수 있습니다.">
        <div className="settings-page__collection">
          <div className="settings-page__create-row">
            <label className="field">
              <span>새 카테고리 이름</span>
              <input
                type="text"
                value={newCategoryName}
                onChange={(event) => onNewCategoryNameChange(event.target.value)}
                disabled={isBusy || !canWrite}
              />
            </label>
            <label className="field">
              <span>예산 그룹</span>
              <select
                value={newCategoryBudgetGroup}
                onChange={(event) => onNewCategoryBudgetGroupChange(event.target.value)}
                disabled={isBusy || !canWrite}
              >
                <option value="">예산에 포함하지 않음</option>
                {budgetGroups.map((groupName) => (
                  <option key={groupName} value={groupName}>{groupName}</option>
                ))}
              </select>
            </label>
            <button type="button" className="primary-button" onClick={onCategoryCreate} disabled={isBusy || !canWrite || !newCategoryName.trim()}>
              추가
            </button>
          </div>
          {categories.map((category) => (
            <article key={category.name} className={`settings-page__item${category.active ? '' : ' is-inactive'}`}>
              <label className="field">
                <span>
                  {category.name}
                  <small className="settings-page__item-meta">
                    {category.budgetGroup ? `예산 · ${category.budgetGroup}` : '예산 미포함'}
                  </small>
                </span>
                <input
                  type="text"
                  value={category.draftName}
                  onChange={(event) => onCategoryDraftNameChange(category.name, event.target.value)}
                  className="settings-page__input settings-page__input--category"
                  disabled={isBusy || !canWrite}
                />
              </label>
              <div className="settings-page__item-actions">
                <button type="button" className="secondary-button" onClick={() => onCategoryRename(category.name)} disabled={isBusy || !canWrite || !category.draftName.trim() || category.draftName.trim() === category.name}>
                  이름 변경
                </button>
                <button
                  type="button"
                  onClick={() => onCategoryDisableToggle(category.name, !category.active)}
                  className="text-button text-button--danger"
                  disabled={isBusy || !canWrite || !category.active}
                >
                  {category.active ? '사용중지' : '사용중지됨'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="연도 연결" description="연도별 시트를 등록하고 바로 열 수 있습니다.">
        <div className="settings-page__years">
          <div className="settings-page__year-form">
            <label className="field">
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
                disabled={isBusy || !canWrite}
              />
            </label>
            <label className="field">
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
                placeholder="https://docs.google.com/spreadsheets/d/..."
                disabled={isBusy || !canWrite}
              />
            </label>
            <button type="button" className="primary-button" onClick={onYearLinkSubmit} disabled={isBusy || !canWrite || !yearLinkDraft.year.trim() || !yearLinkDraft.spreadsheetUrl.trim()}>
              연도 연결 저장
            </button>
          </div>
          <ul className="settings-page__year-list">
            {yearLinks.map((yearLink) => (
              <li
                key={yearLink.year}
                className="settings-page__year-item"
              >
                <div className="settings-page__year-heading">
                  <div>
                    <strong>{yearLink.year}년</strong>
                    <p>{yearLink.connected ? '연결됨' : '미연결'}</p>
                  </div>
                  <button type="button" className="secondary-button" onClick={() => onOpenSheet(yearLink.year)}>
                    시트 열기
                  </button>
                </div>
                <p className="settings-page__spreadsheet-id">Spreadsheet ID · {yearLink.spreadsheetId}</p>
              </li>
            ))}
          </ul>
        </div>
      </SettingsSection>

      <SettingsSection
        title="월 0 동기화"
        description="월 0은 일방향 동기화입니다. 실행하면 기준 시트의 값으로 덮어쓰므로 확인이 필요합니다."
      >
        <div className="settings-page__sync">
          <p className="settings-page__sync-warning">
            월 0 동기화는 되돌릴 수 없습니다.
          </p>
          {!canSyncMonthZero ? <p className="form-status">이전 연도 Sheet를 먼저 연결해야 합니다.</p> : null}
          <button type="button" className="secondary-button secondary-button--danger" onClick={onRequestMonthZeroSync} disabled={isBusy || !canWrite || !canSyncMonthZero}>
            월 0 동기화 확인
          </button>
        </div>
      </SettingsSection>

      {renderConfirmation(confirmation, isBusy)}
    </section>
  )
}
