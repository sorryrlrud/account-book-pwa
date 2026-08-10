export interface MetricRowItem {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative' | 'warning'
}

export interface MetricRowsProps {
  items: MetricRowItem[]
  emptyMessage?: string
}

const toneStyles: Record<NonNullable<MetricRowItem['tone']>, string> = {
  default: 'inherit',
  positive: '#0f766e',
  negative: '#b91c1c',
  warning: '#9a3412',
}

export function MetricRows({
  items,
  emptyMessage = '표시할 항목이 없습니다.',
}: MetricRowsProps) {
  if (items.length === 0) {
    return (
      <p className="metric-rows__empty" role="status">
        {emptyMessage}
      </p>
    )
  }

  return (
    <dl className="metric-rows" style={{ margin: 0, display: 'grid', gap: '10px' }}>
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="metric-rows__item"
          style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}
        >
          <dt className="metric-rows__label">{item.label}</dt>
          <dd
            className="metric-rows__value"
            style={{ margin: 0, color: toneStyles[item.tone ?? 'default'] }}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
