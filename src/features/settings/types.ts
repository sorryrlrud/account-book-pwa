import type { Account, Category, LinkedYear } from '@/domain'

export interface EditableAccount extends Account {
  draftName: string
}

export interface EditableCategory extends Category {
  draftName: string
}

export interface SettingsYearLinkItem extends LinkedYear {
  spreadsheetUrl?: string
}

export interface SettingsYearLinkDraft {
  year: string
  spreadsheetUrl: string
}

export interface SettingsConfirmation {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}
