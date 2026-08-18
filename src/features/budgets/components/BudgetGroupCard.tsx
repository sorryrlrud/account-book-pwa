import type { ReactNode } from 'react'
import { formatCurrency, formatSignedCurrency } from '@/features/readViews/formatters'
import type { BudgetGroupView } from '@/features/budgets/types'

export interface BudgetGroupCardProps {
  item: BudgetGroupView
  expanded?: boolean
  onSelect?: (groupName: string) => void
  children?: ReactNode
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, value))
}

export function BudgetGroupCard({ item, expanded = false, onSelect, children }: BudgetGroupCardProps) {
  const spentRatio =
    item.monthly.effectiveBudget <= 0
      ? (item.monthly.spent > 0 ? 100 : 0)
      : (item.monthly.spent / item.monthly.effectiveBudget) * 100
  const progressWidth = `${clampPercent(spentRatio)}%`
  const progressLabel = Math.max(0, Math.round(spentRatio))
  const isOverBudget = item.monthly.remaining < 0

  return (
    <article
      className={`budget-group-card${expanded ? ' is-expanded' : ''}${isOverBudget ? ' is-over-budget' : ''}`}
    >
      <button
        type="button"
        className="budget-group-card__toggle"
        onClick={() => onSelect?.(item.group.name)}
        aria-expanded={expanded}
      >
        <div className="budget-group-card__header">
          <h3 className="budget-group-card__title">{item.group.name}</h3>
          <span className="budget-group-card__chevron" aria-hidden="true">
            {expanded ? '−' : '+'}
          </span>
        </div>

        <div
          className="budget-group-card__progress"
          aria-label={`${item.group.name} 예산 진행률`}
        >
          <div className="budget-group-card__progress-track" aria-hidden="true">
            <div className="budget-group-card__progress-value" style={{ width: progressWidth }} />
          </div>
          <span className="budget-group-card__progress-label">{progressLabel}% 사용</span>
        </div>

        <dl className="budget-group-card__summary">
          <div><dt>사용</dt><dd>{formatCurrency(item.monthly.spent)}</dd></div>
          <div><dt>남음</dt><dd>{formatSignedCurrency(item.monthly.remaining)}</dd></div>
          <div><dt>전체</dt><dd>{formatCurrency(item.monthly.effectiveBudget)}</dd></div>
        </dl>
      </button>

      {expanded ? (
        <div className="budget-group-card__expanded">
          <dl className="budget-group-card__details">
            {item.details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{formatSignedCurrency(detail.amount)}</dd>
              </div>
            ))}
            <div>
              <dt>다음 달 예상</dt>
              <dd>{formatSignedCurrency(item.monthly.nextMonthExpected)}</dd>
            </div>
          </dl>

          {item.note ? <p className="budget-group-card__note">{item.note}</p> : null}
          {children}
        </div>
      ) : null}
    </article>
  )
}
