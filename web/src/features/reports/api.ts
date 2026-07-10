import { apiFetch } from '../../lib/fetchClient'

export interface CategorySpend {
  categoryId: string
  name: string
  total: number
}

export interface ReportAccount {
  id: string
  name: string
  type: string
  balance: number
}

export interface ReportSummary {
  accounts: ReportAccount[]
  monthIncome: number
  monthExpense: number
  monthNet: number
}

export function getCategorySpend(month: string): Promise<CategorySpend[]> {
  return apiFetch(`/reports/category-spend?month=${encodeURIComponent(month)}`)
}

export function getSummary(month: string): Promise<ReportSummary> {
  return apiFetch(`/reports/summary?month=${encodeURIComponent(month)}`)
}
