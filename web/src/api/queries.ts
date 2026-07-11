// Read hooks. Endpoint shapes live here and in mutations.ts.
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { keys } from "./keys";
import type {
  Account,
  BudgetStatus,
  CategorySpend,
  Category,
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
