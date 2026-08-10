import type { BudgetSummary } from '@/domain'

export interface BudgetDetailItem {
  label: string
  amount: number
  emphasis?: 'default' | 'positive' | 'negative'
}

export interface BudgetGroupView extends BudgetSummary {
  details: BudgetDetailItem[]
  note?: string
}

export interface BudgetAdjustmentDraft {
  groupName: string
  amount: string
  reason: string
}

export interface BudgetAdjustmentConfirmation {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}
