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
    item.monthly.effectiveBudget <= 0
      ? (item.monthly.spent > 0 ? 100 : 0)
      : (item.monthly.spent / item.monthly.effectiveBudget) * 100
  const progressWidth = `${clampPercent(spentRatio)}%`
  const progressLabel = Math.max(0, Math.round(spentRatio))
  const isOverBudget = item.monthly.remaining < 0

  return (
    <article
      className={`budget-group-card${selected ? ' is-selected' : ''}${isOverBudget ? ' is-over-budget' : ''}`}
    >
      <div className="budget-group-card__header">
        <div>
          <h3 className="budget-group-card__title">
            {item.group.name}
          </h3>
          <p className="budget-group-card__status">
            {item.group.active ? '사용 중' : '비활성'}
          </p>
        </div>
        {onSelect ? (
          <button
            type="button"
            className="budget-group-card__select"
            onClick={() => onSelect(item.group.name)}
            aria-pressed={selected}
          >
            {selected ? '선택됨' : '상세 보기'}
          </button>
        ) : null}
      </div>

      <div
        className="budget-group-card__progress"
        aria-label={`${item.group.name} 예산 진행률`}
      >
        <div
          className="budget-group-card__progress-track"
          aria-hidden="true"
        >
          <div
            className="budget-group-card__progress-value"
            style={{ width: progressWidth }}
          />
        </div>
        <span className="budget-group-card__progress-label">{progressLabel}% 사용</span>
      </div>

      <dl className="budget-group-card__summary">
        <div>
          <dt>유효 예산</dt>
          <dd>{formatCurrency(item.monthly.effectiveBudget)}</dd>
        </div>
        <div>
          <dt>사용 금액</dt>
          <dd>{formatCurrency(item.monthly.spent)}</dd>
        </div>
        <div>
          <dt>남은 금액</dt>
          <dd>{formatSignedCurrency(item.monthly.remaining)}</dd>
        </div>
        <div>
          <dt>다음 달 예상</dt>
          <dd>{formatSignedCurrency(item.monthly.nextMonthExpected)}</dd>
        </div>
      </dl>

      <dl className="budget-group-card__details">
        {item.details.map((detail) => (
          <div key={detail.label}>
            <dt>{detail.label}</dt>
            <dd
              style={{
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

      {item.note ? <p className="budget-group-card__note">{item.note}</p> : null}
    </article>
  )
}
