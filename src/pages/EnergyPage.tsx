import type { EnergySummary } from '@/domain'
import { MetricRows } from '@/features/readViews/components/MetricRows'
import { SummaryCard } from '@/features/readViews/components/SummaryCard'

export interface EnergyPageProps {
  year: number
  summary?: EnergySummary
  formatError?: string
}

export default function EnergyPage({
  year,
  summary,
  formatError,
}: EnergyPageProps) {
  return (
    <section className="read-page energy-page">
      <header className="read-page__header energy-page__header">
        <div>
          <p className="read-page__eyebrow energy-page__eyebrow">
            에너지
          </p>
          <h2 className="read-page__title energy-page__title">
            {year}년 에너지 현황
          </h2>
          <p className="read-page__description">에너지 탭에 정리된 현재 요약을 조회합니다.</p>
        </div>
      </header>

      {formatError ? (
        <section className="form-error read-page__error" role="alert">
          <h3>형식 오류</h3>
          <p>{formatError}</p>
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
          <ul className="read-page__warnings energy-page__warnings">
            {summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </SummaryCard>
      ) : null}
    </section>
  )
}
