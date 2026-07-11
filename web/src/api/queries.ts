// Read hooks. Endpoint shapes live here and in mutations.ts.
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { keys } from "./keys";
import type {
  Account,
  Anomaly,
  BudgetStatus,
  CategorySpend,
  Category,
  Comparison,
  Forecast,
  RecurringRule,
  Summary,
  Transaction,
} from "./types";

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api.get<{ authenticated: boolean }>("/auth/me"),
    retry: false,
    staleTime: 60_000,
  });
}

export function useAccounts() {
  return useQuery({ queryKey: keys.accounts, queryFn: () => api.get<Account[]>("/accounts") });
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.get<Category[]>("/categories"),
    staleTime: 5 * 60_000,
  });
}

export function useRecurring() {
  return useQuery({
    queryKey: keys.recurring,
    queryFn: () => api.get<RecurringRule[]>("/recurring"),
  });
}

export function useSummary(month: string) {
  return useQuery({
    queryKey: keys.summary(month),
    queryFn: () => api.get<Summary>(`/reports/summary?month=${month}`),
  });
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: keys.budgets(month),
    queryFn: () => api.get<BudgetStatus[]>(`/budgets?month=${month}`),
  });
}

export function useCategorySpend(month: string) {
  return useQuery({
    queryKey: keys.spend(month),
    queryFn: () => api.get<CategorySpend[]>(`/reports/category-spend?month=${month}`),
  });
}

export function useTransactions(month: string) {
  return useQuery({
    queryKey: keys.txns(month),
    queryFn: () => api.get<Transaction[]>(`/transactions?month=${month}&limit=200`),
  });
}

export function useForecast(month: string) {
  return useQuery({
    queryKey: keys.forecast(month),
    queryFn: () => api.get<Forecast>(`/insights/forecast?month=${month}`),
  });
}

export function useAnomalies(month: string) {
  return useQuery({
    queryKey: keys.anomalies(month),
    queryFn: () => api.get<Anomaly[]>(`/insights/anomalies?month=${month}`),
  });
}

export function useComparisons(month: string) {
  return useQuery({
    queryKey: keys.comparisons(month),
    queryFn: () => api.get<Comparison[]>(`/insights/comparisons?month=${month}`),
  });
}

/** Latest transactions across all months — powers quick-add "repeat" templates. */
export function useRecentTransactions() {
  return useQuery({
    queryKey: keys.recentTxns,
    queryFn: () => api.get<Transaction[]>("/transactions?limit=30"),
  });
}
