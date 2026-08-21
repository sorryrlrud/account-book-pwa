import type { BudgetSummary } from '@/domain'

export interface BudgetDetailItem {
  label: string
  amount: number
  signed?: boolean
  emphasis?: 'default' | 'positive' | 'negative'
}

export interface BudgetGroupView extends BudgetSummary {
  details: BudgetDetailItem[]
  note?: string
}

export interface BudgetEditorGroup {
  name: string
  allocatedBudget: number
  isNew?: boolean
}

export interface BudgetEditorDraft {
  maximumBudget: string
  groups: BudgetEditorGroup[]
}

export interface BudgetConfirmation {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}
