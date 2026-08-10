import type {
  LegacyTransactionFingerprint,
  Transaction,
  TransactionDraft,
} from '@/domain/transaction.ts'
import {
  inferLegacyTransactionType,
  toSignedAmount,
} from '@/domain/transaction.ts'
import { AppError } from '@/domain/errors.ts'
import { parseLedgerDate } from '@/utils/date.ts'
import {
  parseSheetNumber,
  toUserEnteredLiteral,
  trimCell,
} from '@/utils/format.ts'

export interface SheetTransactionRow {
  rowNumber: number
  values: string[]
}

export interface AppendTransactionRowsResult {
  rows: string[][]
  transactionId?: string
  transferId?: string
}

function inferTransactionTypeFromMetadata(
  typeCell: string,
  amount: number,
  category?: string,
): Transaction['type'] {
  switch (trimCell(typeCell)) {
    case 'expense':
      return 'expense'
    case 'income':
      return 'income'
    case 'transfer':
      return 'transfer'
    default:
      return inferLegacyTransactionType(amount, category)
  }
}

export function parseTransactionRow(
  sourceYear: number,
  sourceMonth: number,
  row: SheetTransactionRow,
): Transaction | undefined {
  const [rawDate, rawAmount, rawDescription, rawAccount, rawCategory] = row.values
  if (![rawDate, rawAmount, rawDescription, rawAccount, rawCategory].some(Boolean)) {
    return undefined
  }

  const dateCell = trimCell(rawDate)
  const amountCell = trimCell(rawAmount).toLowerCase()
  if (
    row.rowNumber === 1 &&
    (['날짜', 'date'].includes(dateCell.toLowerCase()) ||
      ['금액', 'amount'].includes(amountCell))
  ) {
    return undefined
  }

  let date: string
  try {
    date = parseLedgerDate(dateCell)
  } catch {
    return undefined
  }

  const amount = parseSheetNumber(rawAmount)
  const description = trimCell(rawDescription)
  const account = trimCell(rawAccount)
  const category = trimCell(rawCategory) || undefined
  const type = inferTransactionTypeFromMetadata(row.values[23] ?? '', amount, category)
  const transactionId = trimCell(row.values[24]) || undefined
  const transferId = trimCell(row.values[25]) || undefined

  const transaction: Transaction = {
    id: transactionId,
    transferId,
    type,
    date,
    amount,
    description,
    account,
    category,
    sourceYear,
    sourceMonth,
    sourceRow: row.rowNumber,
    rawValues: row.values,
    metadataMissing: !transactionId || (type === 'transfer' && !transferId),
  }

  if (type === 'transfer') {
    transaction.destinationAccount = undefined
  }

  return transaction
}

export function parseTransactions(
  sourceYear: number,
  sourceMonth: number,
  rows: string[][],
): Transaction[] {
  return rows
    .map((values, rowIndex) =>
      parseTransactionRow(sourceYear, sourceMonth, {
        rowNumber: rowIndex + 1,
        values,
      }),
    )
    .filter((transaction): transaction is Transaction => Boolean(transaction))
}

export function collapseTransferPairs(
  transactions: Transaction[],
): Transaction[] {
  const transferRowsById = new Map<string, Transaction[]>()
  for (const transaction of transactions) {
    if (transaction.type === 'transfer' && transaction.transferId) {
      const rows = transferRowsById.get(transaction.transferId) ?? []
      rows.push(transaction)
      transferRowsById.set(transaction.transferId, rows)
    }
  }

  const consumedRows = new Set<number>()
  const logicalTransfers = new Map<number, Transaction>()
  for (const rows of transferRowsById.values()) {
    if (rows.length !== 2) {
      continue
    }

    const outgoing = rows.find((transaction) => transaction.amount < 0)
    const incoming = rows.find((transaction) => transaction.amount > 0)
    if (!outgoing || !incoming || outgoing.sourceRow === undefined) {
      continue
    }

    for (const row of rows) {
      if (row.sourceRow !== undefined) consumedRows.add(row.sourceRow)
    }
    logicalTransfers.set(outgoing.sourceRow, {
      ...outgoing,
      destinationAccount: incoming.account,
      metadataMissing: false,
    })
  }

  return transactions.flatMap((transaction) => {
    if (transaction.sourceRow === undefined || !consumedRows.has(transaction.sourceRow)) {
      return [transaction]
    }

    const logicalTransfer = logicalTransfers.get(transaction.sourceRow)
    return logicalTransfer ? [logicalTransfer] : []
  })
}

export function buildAppendRows(
  draft: TransactionDraft,
): AppendTransactionRowsResult {
  if (draft.type === 'transfer') {
    if (!draft.destinationAccount) {
      throw new AppError('VALIDATION_ERROR', '입금 통장을 선택해주세요.')
    }

    const transferId = buildStableId('trf', draft.clientRequestId)
    return {
      transferId,
      rows: [
        buildRow({
          ...draft,
          type: 'transfer',
          account: draft.account,
          amount: -Math.abs(draft.amount),
        }, {
          transferId,
        }),
        buildRow({
          ...draft,
          type: 'transfer',
          account: draft.destinationAccount,
          amount: Math.abs(draft.amount),
        }, {
          transferId,
        }),
      ],
    }
  }

  const transactionId = buildStableId('txn', draft.clientRequestId)
  return {
    transactionId,
    rows: [
      buildRow({
        ...draft,
        amount: toSignedAmount(draft.type, draft.amount),
      }, {
        transactionId,
      }),
    ],
  }
}

function buildStableId(prefix: 'txn' | 'trf', clientRequestId?: string): string {
  const source = clientRequestId || crypto.randomUUID()
  const normalized = source.replaceAll(/[^a-zA-Z0-9]/g, '') ||
    crypto.randomUUID().replaceAll('-', '')
  return `${prefix}_${normalized}`
}

function buildRow(
  draft: Omit<TransactionDraft, 'amount'> & { amount: number },
  ids: { transactionId?: string; transferId?: string },
): string[] {
  const values = new Array<string>(26).fill('')
  values[0] = draft.date
  values[1] = String(draft.amount)
  values[2] = toUserEnteredLiteral(draft.description)
  values[3] = toUserEnteredLiteral(draft.account)
  values[4] = draft.type === 'transfer'
    ? ''
    : toUserEnteredLiteral(draft.category ?? '')
  values[23] = draft.type
  values[24] = ids.transactionId ?? ''
  values[25] = ids.transferId ?? ''
  return values
}

export function matchesLegacyFingerprint(
  transaction: Transaction,
  fingerprint: LegacyTransactionFingerprint,
): boolean {
  return (
    transaction.date === fingerprint.date &&
    transaction.amount === fingerprint.amount &&
    transaction.description === fingerprint.description &&
    transaction.account === fingerprint.account &&
    (transaction.category ?? '') === (fingerprint.category ?? '')
  )
}
