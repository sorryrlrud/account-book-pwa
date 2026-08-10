import type { ReactNode } from 'react'

export interface SettingsSectionProps {
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="panel settings-section">
      <header className="settings-section__header">
        <h2 className="settings-section__title">
          {title}
        </h2>
        {description ? (
          <p className="settings-section__description">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  )
}
