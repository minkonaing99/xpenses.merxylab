import { Banner } from '../../ui/Banner'
import { formatTHB } from '../../lib/money'

interface BudgetBannerProps {
  categoryName: string
  spent: number
  limitAmount: number
  onDismiss: () => void
}

export function BudgetBanner({ categoryName, spent, limitAmount, onDismiss }: BudgetBannerProps) {
  return (
    <Banner
      tone="warning"
      message={`${categoryName} is ${formatTHB(spent - limitAmount)} over budget this month`}
      onDismiss={onDismiss}
    />
  )
}
