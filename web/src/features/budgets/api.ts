import { apiFetch } from '../../lib/fetchClient'

export interface ApiBudget {
  id: string
  categoryId: string
  limitAmount: number
  spent: number
  over: boolean
  updatedAt: string
  deletedAt: string | null
}

export function getBudgets(month: string): Promise<ApiBudget[]> {
  return apiFetch(`/budgets?month=${encodeURIComponent(month)}`)
}
