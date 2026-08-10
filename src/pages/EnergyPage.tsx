import type { EnergySummary } from '@/domain'
import { MetricRows } from '@/features/readViews/components/MetricRows'
import { MonthNavigator } from '@/features/readViews/components/MonthNavigator'
import { SummaryCard } from '@/features/readViews/components/SummaryCard'
import { formatMonthLabel } from '@/features/readViews/formatters'

export interface EnergyPageProps {
  year: number
  month: number
  canGoPrevious?: boolean
  canGoNext?: boolean
  summary?: EnergySummary
  formatError?: string
  onPreviousMonth: () => void
  onNextMonth: () => void
}

export default function EnergyPage({
  year,
  month,
  canGoPrevious = true,
  canGoNext = true,
  summary,
  formatError,
  onPreviousMonth,
  onNextMonth,
}: EnergyPageProps) {
  return (
    <section className="energy-page" style={{ display: 'grid', gap: '16px' }}>
      <header className="energy-page__header" style={{ display: 'grid', gap: '12px' }}>
        <div>
          <p className="energy-page__eyebrow" style={{ margin: 0 }}>
            에너지
          </p>
          <h1 className="energy-page__title" style={{ margin: '8px 0 0' }}>
            {formatMonthLabel(year, month)} 에너지 사용량
          </h1>
        </div>
        <MonthNavigator
          year={year}
          month={month}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onPrevious={onPreviousMonth}
          onNext={onNextMonth}
        />
      </header>

      {formatError ? (
        <section className="energy-page__error" role="alert" style={{ border: '1px solid #b91c1c', borderRadius: '16px', padding: '16px' }}>
          <h2 style={{ marginTop: 0 }}>형식 오류</h2>
          <p style={{ marginBottom: 0 }}>{formatError}</p>
        </section>
      ) : null}

      <SummaryCard title="월별 지표">
        <MetricRows
          items={(summary?.metrics ?? []).map((metric) => ({
            label: metric.label,
            value: [metric.usage, metric.amount].filter(Boolean).join(' / ') || '-',
          }))}
        />
      </SummaryCard>

      {summary?.warnings?.length ? (
        <SummaryCard title="확인 필요">
          <ul className="energy-page__warnings" style={{ margin: 0, paddingLeft: '20px' }}>
            {summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </SummaryCard>
      ) : null}
    </section>
  )
}
