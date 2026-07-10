import {
  ShoppingCart,
  Train,
  MoneyWavy,
  House,
  BowlFood,
  Lightning,
  Coffee,
  ArrowsLeftRight,
  Taxi,
  ShoppingBag,
  Heartbeat,
  FilmSlate,
  Question,
  type IconWeight,
} from '@phosphor-icons/react'
import { formatTHB } from '../lib/money'
import './TxnRow.css'

export type TxnIconName =
  | 'shopping-cart'
  | 'train'
  | 'money-wavy'
  | 'house'
  | 'bowl-food'
  | 'lightning'
  | 'coffee'
  | 'arrows-left-right'
  | 'taxi'
  | 'shopping-bag'
  | 'heartbeat'
  | 'film-slate'
  | 'question'

export type TxnType = 'expense' | 'income' | 'transfer'
export type TxnTint = 'primary' | 'success' | 'warning' | 'transfer'

// Exported so other features needing the same category icon set (e.g.
// BudgetsScreen) don't hardcode a second, drifting subset of these icons.
export const TXN_ICON_COMPONENTS: Record<
  TxnIconName,
  React.ComponentType<{ size?: number; weight?: IconWeight; color?: string; 'aria-hidden'?: boolean }>
> = {
  'shopping-cart': ShoppingCart,
  train: Train,
  'money-wavy': MoneyWavy,
  house: House,
  'bowl-food': BowlFood,
  lightning: Lightning,
  coffee: Coffee,
  'arrows-left-right': ArrowsLeftRight,
  taxi: Taxi,
  'shopping-bag': ShoppingBag,
  heartbeat: Heartbeat,
  'film-slate': FilmSlate,
  question: Question,
}

interface TxnRowProps {
  icon: TxnIconName
  note: string
  caption: string
  amountSatang: number
  type: TxnType
  tint?: TxnTint
}

export function TxnRow({ icon, note, caption, amountSatang, type, tint }: TxnRowProps) {
  const Icon = TXN_ICON_COMPONENTS[icon]
  const resolvedTint = tint ?? (type === 'income' ? 'success' : 'primary')
  const prefix = type === 'income' ? '+' : '-'
  const amountLabel = `${prefix}${formatTHB(Math.abs(amountSatang))}`

  return (
    <div className="txn-row">
      <div className={`txn-row__icon txn-row__icon--${resolvedTint}`}>
        <Icon size={20} weight="fill" aria-hidden={true} />
      </div>
      <div className="txn-row__text">
        <div className="txn-row__note">{note}</div>
        <div className="txn-row__caption">{caption}</div>
      </div>
      <div className={`txn-row__amount tabular txn-row__amount--${type}`}>{amountLabel}</div>
    </div>
  )
}
