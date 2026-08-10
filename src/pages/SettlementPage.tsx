import type { SettlementSummary } from '@/domain'
import { MetricRows } from '@/features/readViews/components/MetricRows'
import { MonthNavigator } from '@/features/readViews/components/MonthNavigator'
import { SummaryCard } from '@/features/readViews/components/SummaryCard'
import { formatCurrency, formatMonthLabel, formatSignedCurrency } from '@/features/readViews/formatters'

export interface SettlementBudgetItem {
  groupName: string
  effectiveBudget: number
  spent: number
  remaining: number
}

export interface SettlementPageProps {
  summary: SettlementSummary
  budgets: SettlementBudgetItem[]
  onPreviousMonth: () => void
  onNextMonth: () => void
  canGoPrevious?: boolean
  canGoNext?: boolean
  monthNotice?: string
}

export default function SettlementPage({
  summary,
  budgets,
  onPreviousMonth,
  onNextMonth,
  canGoPrevious = true,
  canGoNext = true,
  monthNotice,
}: SettlementPageProps) {
  return (
    <section className="read-page settlement-page">
      <header className="read-page__header settlement-page__header">
        <p className="read-page__eyebrow settlement-page__eyebrow">
          정산
        </p>
        <h2 className="read-page__title settlement-page__title">
          {formatMonthLabel(summary.year, summary.month)} 정산 요약
        </h2>
        <MonthNavigator
          year={summary.year}
          month={summary.month}
          onPrevious={onPreviousMonth}
          onNext={onNextMonth}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          notice={monthNotice}
        />
      </header>

      <SummaryCard title="수입 및 지출">
        <MetricRows
          items={[
            { label: '총수입', value: formatCurrency(summary.income), tone: 'positive' },
            { label: '총지출', value: formatCurrency(summary.expense), tone: 'negative' },
            {
              label: '순증감',
              value: formatSignedCurrency(summary.income - summary.expense),
              tone: summary.income - summary.expense >= 0 ? 'positive' : 'negative',
            },
          ]}
        />
      </SummaryCard>

      <SummaryCard title="계좌별 잔액">
        <MetricRows
          items={summary.accounts.map((account) => ({
            label: account.account,
            value: `${formatCurrency(account.previousMonthBalance)} → ${formatCurrency(account.currentMonthBalance)} (${formatSignedCurrency(account.delta)})`,
            tone: account.delta >= 0 ? 'positive' : 'negative',
          }))}
          emptyMessage="표시할 계좌 정산 내역이 없습니다."
        />
      </SummaryCard>

      <SummaryCard title="예산 요약">
        <MetricRows
          items={budgets.map((budget) => ({
            label: budget.groupName,
            value: `${formatCurrency(budget.spent)} / ${formatCurrency(budget.effectiveBudget)} (잔액 ${formatSignedCurrency(budget.remaining)})`,
            tone: budget.remaining >= 0 ? 'default' : 'warning',
          }))}
          emptyMessage="표시할 예산 요약이 없습니다."
        />
      </SummaryCard>
    </section>
  )
}
