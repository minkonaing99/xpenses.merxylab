// One source of truth for React Query cache keys.
export const keys = {
  me: ["me"] as const,
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  recurring: ["recurring"] as const,
  summary: (m: string) => ["summary", m] as const,
  budgets: (m: string) => ["budgets", m] as const,
  spend: (m: string) => ["spend", m] as const,
  txns: (m: string) => ["txns", m] as const,
  recentTxns: ["txns", "recent"] as const,
  forecast: (m: string) => ["forecast", m] as const,
  anomalies: (m: string) => ["anomalies", m] as const,
  comparisons: (m: string) => ["comparisons", m] as const,
};

/** Every month-scoped query. Invalidate all after a txn write. */
export function monthKeys(m: string) {
  return [
    keys.summary(m),
    keys.budgets(m),
    keys.spend(m),
    keys.txns(m),
    keys.forecast(m),
    keys.anomalies(m),
    keys.comparisons(m),
  ];
}
