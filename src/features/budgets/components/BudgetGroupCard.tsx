import { formatCurrency, formatSignedCurrency } from '@/features/readViews/formatters'
import type { BudgetGroupView } from '@/features/budgets/types'

export interface BudgetGroupCardProps {
  item: BudgetGroupView
  selected?: boolean
  onSelect?: (groupName: string) => void
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, value))
}

export function BudgetGroupCard({ item, selected = false, onSelect }: BudgetGroupCardProps) {
  const spentRatio =
    item.monthly.effectiveBudget === 0
      ? 0
      : (item.monthly.spent / item.monthly.effectiveBudget) * 100
  const progressWidth = `${clampPercent(spentRatio)}%`

  return (
    <article
      className="budget-group-card"
      aria-current={selected}
      style={{
        border: '1px solid currentColor',
        borderRadius: '16px',
        padding: '16px',
        display: 'grid',
        gap: '12px',
      }}
    >
      <div className="budget-group-card__header" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h3 className="budget-group-card__title" style={{ margin: 0 }}>
            {item.group.name}
          </h3>
          <p className="budget-group-card__status" style={{ margin: '8px 0 0' }}>
            {item.group.active ? '사용 중' : '비활성'}
          </p>
        </div>
        {onSelect ? (
          <button
            type="button"
            className="budget-group-card__select"
            onClick={() => onSelect(item.group.name)}
            style={{ minHeight: '44px', minWidth: '88px' }}
          >
            {selected ? '선택됨' : '상세 보기'}
          </button>
        ) : null}
      </div>

      <div
        className="budget-group-card__progress"
        aria-label={`${item.group.name} 예산 진행률`}
        style={{ display: 'grid', gap: '8px' }}
      >
        <div
          className="budget-group-card__progress-track"
          aria-hidden="true"
          style={{ width: '100%', height: '10px', borderRadius: '999px', background: '#d4d4d4' }}
        >
          <div
            className="budget-group-card__progress-value"
            style={{ width: progressWidth, height: '100%', borderRadius: '999px', background: '#174a3b' }}
          />
        </div>
        <span className="budget-group-card__progress-label">{Math.round(clampPercent(spentRatio))}% 사용</span>
      </div>

      <dl className="budget-group-card__summary" style={{ margin: 0, display: 'grid', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <dt>유효 예산</dt>
          <dd style={{ margin: 0 }}>{formatCurrency(item.monthly.effectiveBudget)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <dt>사용 금액</dt>
          <dd style={{ margin: 0 }}>{formatCurrency(item.monthly.spent)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <dt>남은 금액</dt>
          <dd style={{ margin: 0 }}>{formatSignedCurrency(item.monthly.remaining)}</dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <dt>다음 달 예상</dt>
          <dd style={{ margin: 0 }}>{formatSignedCurrency(item.monthly.nextMonthExpected)}</dd>
        </div>
      </dl>

      <dl className="budget-group-card__details" style={{ margin: 0, display: 'grid', gap: '8px' }}>
        {item.details.map((detail) => (
          <div key={detail.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <dt>{detail.label}</dt>
            <dd
              style={{
                margin: 0,
                color:
                  detail.emphasis === 'positive'
                    ? '#0f766e'
                    : detail.emphasis === 'negative'
                      ? '#b91c1c'
                      : 'inherit',
              }}
            >
              {formatSignedCurrency(detail.amount)}
            </dd>
          </div>
        ))}
      </dl>

      {item.note ? <p className="budget-group-card__note" style={{ margin: 0 }}>{item.note}</p> : null}
    </article>
  )
}
