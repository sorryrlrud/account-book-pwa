import { formatMonthLabel } from '@/features/readViews/formatters'

export interface MonthNavigatorProps {
  year: number
  month: number
  canGoPrevious?: boolean
  canGoNext?: boolean
  previousLabel?: string
  nextLabel?: string
  notice?: string
  onPrevious: () => void
  onNext: () => void
}

export function MonthNavigator({
  year,
  month,
  canGoPrevious = true,
  canGoNext = true,
  previousLabel = '이전 달',
  nextLabel = '다음 달',
  notice,
  onPrevious,
  onNext,
}: MonthNavigatorProps) {
  return (
    <div className="month-navigator-wrap">
      <nav aria-label="월 이동" className="month-navigator">
        <button
          type="button"
          className="icon-button icon-button--soft month-navigator__button"
          onClick={onPrevious}
          disabled={!canGoPrevious}
          aria-label={previousLabel}
        >
          <span className="icon-button__emoji" aria-hidden="true">◀️</span>
        </button>
        <strong className="month-navigator__label" aria-live="polite">
          {formatMonthLabel(year, month)}
        </strong>
        <button
          type="button"
          className="icon-button icon-button--soft month-navigator__button"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label={nextLabel}
        >
          <span className="icon-button__emoji" aria-hidden="true">▶️</span>
        </button>
      </nav>
      {notice ? <p className="month-navigator__notice">{notice}</p> : null}
    </div>
  )
}
