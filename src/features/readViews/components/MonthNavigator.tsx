import { CONTROL_STYLE, formatMonthLabel } from '@/features/readViews/formatters'

export interface MonthNavigatorProps {
  year: number
  month: number
  canGoPrevious?: boolean
  canGoNext?: boolean
  previousLabel?: string
  nextLabel?: string
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
  onPrevious,
  onNext,
}: MonthNavigatorProps) {
  return (
    <nav
      aria-label="월 이동"
      className="month-navigator"
      style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
    >
      <button
        type="button"
        className="month-navigator__button month-navigator__button--previous"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        style={{ ...CONTROL_STYLE, flex: 1 }}
      >
        {previousLabel}
      </button>
      <strong
        className="month-navigator__label"
        aria-live="polite"
        style={{ minWidth: '120px', textAlign: 'center' }}
      >
        {formatMonthLabel(year, month)}
      </strong>
      <button
        type="button"
        className="month-navigator__button month-navigator__button--next"
        onClick={onNext}
        disabled={!canGoNext}
        style={{ ...CONTROL_STYLE, flex: 1 }}
      >
        {nextLabel}
      </button>
    </nav>
  )
}
