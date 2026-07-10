import type { CachedTransaction, CachedCategory, CachedAccount } from '../../offline/db'
import type { TxnIconName, TxnType } from '../../ui/TxnRow'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Transfers move money between the user's own accounts — they net to zero
// and must not be counted as income or expense.
export function calculateNet(transactions: Pick<CachedTransaction, 'type' | 'amount'>[]): number {
  return transactions.reduce((sum, t) => {
    if (t.type === 'income') return sum + t.amount
    if (t.type === 'expense') return sum - t.amount
    return sum
  }, 0)
}

export function formatTxnDate(txnDate: string, today: string): string {
  if (txnDate === today) return 'Today'
  const [, m, d] = txnDate.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}

const CATEGORY_ICON: Record<string, TxnIconName> = {
  Food: 'bowl-food',
  Groceries: 'shopping-cart',
  Transport: 'taxi',
  Bills: 'lightning',
  Shopping: 'shopping-bag',
  Health: 'heartbeat',
  Entertainment: 'film-slate',
  Rent: 'house',
  Salary: 'money-wavy',
  Other: 'question',
}

export function iconForTxn(type: TxnType, categoryName?: string | null): TxnIconName {
  if (type === 'transfer') return 'arrows-left-right'
  if (type === 'income') return 'money-wavy'
  if (categoryName && CATEGORY_ICON[categoryName]) return CATEGORY_ICON[categoryName]
  return 'question'
}

export interface TxnDisplayContext {
  categoriesById: Map<string, CachedCategory>
  accountsById: Map<string, CachedAccount>
  today: string
}

export interface TxnRowDisplayProps {
  icon: TxnIconName
  note: string
  caption: string
  amountSatang: number
  type: TxnType
}

export function toTxnRowProps(txn: CachedTransaction, ctx: TxnDisplayContext): TxnRowDisplayProps {
  const type = txn.type as TxnType
  const date = formatTxnDate(txn.txnDate, ctx.today)

  let label: string
  let categoryName: string | undefined
  if (type === 'expense') {
    categoryName = txn.categoryId ? ctx.categoriesById.get(txn.categoryId)?.name : undefined
    label = categoryName ?? 'Uncategorized'
  } else if (type === 'income') {
    label = (txn.accountId && ctx.accountsById.get(txn.accountId)?.name) ?? 'Income'
  } else {
    const from = (txn.fromAccountId && ctx.accountsById.get(txn.fromAccountId)?.name) ?? '?'
    const to = (txn.toAccountId && ctx.accountsById.get(txn.toAccountId)?.name) ?? '?'
    label = `${from} → ${to}`
  }

  return {
    icon: iconForTxn(type, categoryName),
    note: txn.note || label,
    caption: `${label} · ${date}`,
    amountSatang: txn.amount,
    type,
  }
}
