import type { ReactNode } from 'react'

export interface SummaryCardProps {
  title: string
  description?: string
  children: ReactNode
}

export function SummaryCard({ title, description, children }: SummaryCardProps) {
  return (
    <section className="panel summary-card">
      <header className="summary-card__header">
        <h2 className="summary-card__title">
          {title}
        </h2>
        {description ? (
          <p className="summary-card__description">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  )
}
