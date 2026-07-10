export interface TxnFieldsInput {
  type: string
  categoryId?: string | null
  accountId?: string | null
  fromAccountId?: string | null
  toAccountId?: string | null
}

// Client-side mirror of server/features/transactions/service.js's
// validateTransactionFields — fails fast in the form instead of waiting for
// an async push to come back with a 400 after the optimistic write already
// showed success. Keep both in sync if the invariants ever change (see
// docs/SCHEMA.md "Application-level invariants").
export function validateTransactionFields({
  type,
  categoryId,
  accountId,
  fromAccountId,
  toAccountId,
}: TxnFieldsInput): string | null {
  if (type === 'expense') {
    if (!categoryId) return 'expense requires categoryId'
    if (!accountId) return 'expense requires accountId'
    if (fromAccountId) return 'expense must not set fromAccountId'
    if (toAccountId) return 'expense must not set toAccountId'
    return null
  }

  if (type === 'income') {
    if (!accountId) return 'income requires accountId'
    if (categoryId) return 'income must not set categoryId'
    if (fromAccountId) return 'income must not set fromAccountId'
    if (toAccountId) return 'income must not set toAccountId'
    return null
  }

  if (type === 'transfer') {
    if (!fromAccountId) return 'transfer requires fromAccountId'
    if (!toAccountId) return 'transfer requires toAccountId'
    if (fromAccountId === toAccountId) return 'transfer fromAccountId and toAccountId must differ'
    if (accountId) return 'transfer must not set accountId'
    if (categoryId) return 'transfer must not set categoryId'
    return null
  }

  return `unknown transaction type: ${type}`
}
