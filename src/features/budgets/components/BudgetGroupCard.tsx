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
  const availableBudget = item.monthly.effectiveBudget
  const remainingRatio =
    availableBudget <= 0
      ? 0
      : (item.monthly.remaining / availableBudget) * 100
  const progressWidth = `${clampPercent(remainingRatio)}%`
  const remainingPercent = Math.round(clampPercent(remainingRatio))
  const progressLabel = `${remainingPercent}% 남음 (${formatCurrency(item.monthly.remaining).replace(/원$/, '')} / ${formatCurrency(availableBudget)})`
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
          aria-label={`${item.group.name} 잔여 예산 ${Math.round(clampPercent(remainingRatio))}%`}
        >
          <div className="budget-group-card__progress-track" aria-hidden="true">
            <div className="budget-group-card__progress-value" style={{ width: progressWidth }} />
          </div>
          <span className="budget-group-card__progress-label">{progressLabel}</span>
        </div>
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
