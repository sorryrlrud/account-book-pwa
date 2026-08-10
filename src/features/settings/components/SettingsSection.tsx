import type { ReactNode } from 'react'

export interface SettingsSectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section
      className="settings-section"
      style={{ border: '1px solid currentColor', borderRadius: '16px', padding: '16px' }}
    >
      <header className="settings-section__header" style={{ marginBottom: '12px' }}>
        <h2 className="settings-section__title" style={{ margin: 0 }}>
          {title}
        </h2>
        {description ? (
          <p className="settings-section__description" style={{ margin: '8px 0 0' }}>
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  )
}
