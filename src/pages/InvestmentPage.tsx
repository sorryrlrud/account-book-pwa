import type { InvestmentSummary } from '@/domain'
import { MetricRows } from '@/features/readViews/components/MetricRows'
import { MonthNavigator } from '@/features/readViews/components/MonthNavigator'
import { SummaryCard } from '@/features/readViews/components/SummaryCard'
import { formatMonthLabel } from '@/features/readViews/formatters'

export interface InvestmentPageProps {
  year: number
  month: number
  canGoPrevious?: boolean
  canGoNext?: boolean
  summary?: InvestmentSummary
  formatError?: string
  onPreviousMonth: () => void
  onNextMonth: () => void
}

export default function InvestmentPage({
  year,
  month,
  canGoPrevious = true,
  canGoNext = true,
  summary,
  formatError,
  onPreviousMonth,
  onNextMonth,
}: InvestmentPageProps) {
  return (
    <section className="investment-page" style={{ display: 'grid', gap: '16px' }}>
      <header className="investment-page__header" style={{ display: 'grid', gap: '12px' }}>
        <div>
          <p className="investment-page__eyebrow" style={{ margin: 0 }}>
            투자
          </p>
          <h1 className="investment-page__title" style={{ margin: '8px 0 0' }}>
            {formatMonthLabel(year, month)} 투자 현황
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
        <section className="investment-page__error" role="alert" style={{ border: '1px solid #b91c1c', borderRadius: '16px', padding: '16px' }}>
          <h2 style={{ marginTop: 0 }}>형식 오류</h2>
          <p style={{ marginBottom: 0 }}>{formatError}</p>
        </section>
      ) : null}

      <SummaryCard title="핵심 지표">
        <MetricRows items={(summary?.metrics ?? []).map((metric) => ({ label: metric.label, value: metric.value }))} />
      </SummaryCard>

      <SummaryCard title="자산 배분">
        <MetricRows
          items={(summary?.allocation ?? []).map((metric) => ({
            label: metric.label,
            value: metric.value,
          }))}
        />
      </SummaryCard>

      {summary?.warnings?.length ? (
        <SummaryCard title="확인 필요">
          <ul className="investment-page__warnings" style={{ margin: 0, paddingLeft: '20px' }}>
            {summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </SummaryCard>
      ) : null}
    </section>
  )
}
