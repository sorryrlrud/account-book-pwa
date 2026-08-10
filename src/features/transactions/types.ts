import type { Transaction, TransactionDraft } from '@/domain/transaction.ts'

export type EntryMode = 'create' | 'edit'

export type EntryTab = TransactionDraft['type']

export interface TransactionFormState {
  type: EntryTab
  date: string
  amountInput: string
  description: string
  account: string
  category: string
  destinationAccount: string
}

export interface TransactionFormSubmitPayload {
  transaction?: Transaction
  draft: TransactionDraft
  resetState: TransactionFormState
}
