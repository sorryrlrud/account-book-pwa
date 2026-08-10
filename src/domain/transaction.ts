export type TransactionType = 'expense' | 'income' | 'transfer' | 'unknown'

export interface TransactionBase {
  id?: string
  transferId?: string
  date: string
  amount: number
  description: string
  account: string
  category?: string
  sourceYear: number
  sourceMonth: number
  sourceRow?: number
}

export interface Transaction extends TransactionBase {
  type: TransactionType
  destinationAccount?: string
  rawValues?: string[]
  metadataMissing?: boolean
}

export interface TransactionDraft {
  clientRequestId?: string
  type: Exclude<TransactionType, 'unknown'>
  date: string
  amount: number
  description: string
  account: string
  category?: string
  destinationAccount?: string
}

export interface LegacyTransactionFingerprint {
  date: string
  amount: number
  description: string
  account: string
  category?: string
}

export interface TransactionLookup {
  year: number
  month: number
  transactionId?: string
  transferId?: string
  sourceRow?: number
  legacyFingerprint?: LegacyTransactionFingerprint
}

export interface SavedTransactionResult {
  transaction: Transaction
  relatedTransaction?: Transaction
}

export function inferLegacyTransactionType(
  amount: number,
  category?: string,
): TransactionType {
  if (!category) {
    return 'unknown'
  }

  if (amount < 0) {
    return 'expense'
  }

  if (amount > 0) {
    return 'income'
  }

  return 'unknown'
}

export function toSignedAmount(
  type: 'expense' | 'income',
  amount: number,
): number {
  return type === 'expense' ? -Math.abs(amount) : Math.abs(amount)
}

export function normalizePositiveAmount(amount: number): number {
  return Math.abs(amount)
}
