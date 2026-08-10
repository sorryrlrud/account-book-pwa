import type { InvestmentSummary } from '@/domain'
import { MetricRows } from '@/features/readViews/components/MetricRows'
import { SummaryCard } from '@/features/readViews/components/SummaryCard'

export interface InvestmentPageProps {
  year: number
  summary?: InvestmentSummary
  formatError?: string
}

export default function InvestmentPage({
  year,
  summary,
  formatError,
}: InvestmentPageProps) {
  return (
    <section className="read-page investment-page">
      <header className="read-page__header investment-page__header">
        <div>
          <p className="read-page__eyebrow investment-page__eyebrow">
            투자
          </p>
          <h2 className="read-page__title investment-page__title">
            {year}년 투자 현황
          </h2>
          <p className="read-page__description">투자 탭에 정리된 현재 요약을 조회합니다.</p>
        </div>
      </header>

      {formatError ? (
        <section className="form-error read-page__error" role="alert">
          <h3>형식 오류</h3>
          <p>{formatError}</p>
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
          <ul className="read-page__warnings investment-page__warnings">
            {summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </SummaryCard>
      ) : null}
    </section>
  )
}
