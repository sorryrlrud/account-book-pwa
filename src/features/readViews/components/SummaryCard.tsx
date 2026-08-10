import type { ReactNode } from 'react'

export interface SummaryCardProps {
  title: string
  description?: string
  children: ReactNode
}

export function SummaryCard({ title, description, children }: SummaryCardProps) {
  return (
    <section
      className="summary-card"
      style={{ border: '1px solid currentColor', borderRadius: '16px', padding: '16px' }}
    >
      <header className="summary-card__header" style={{ marginBottom: '12px' }}>
        <h2 className="summary-card__title" style={{ margin: 0 }}>
          {title}
        </h2>
        {description ? (
          <p className="summary-card__description" style={{ margin: '8px 0 0' }}>
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  )
}
