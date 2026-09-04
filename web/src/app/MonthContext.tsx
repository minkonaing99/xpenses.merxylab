import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { currentMonth } from "../lib/format";

interface MonthCtx {
  month: string; // YYYY-MM
  setMonth: (m: string) => void;
  step: (delta: number) => void;
  isCurrent: boolean;
}

const Ctx = createContext<MonthCtx | null>(null);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Shared selected month across dashboard, ledger, reports, budgets. */
export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(currentMonth());
  const value = useMemo<MonthCtx>(
    () => ({
      month,
      setMonth,
      step: (delta) => setMonth((m) => shiftMonth(m, delta)),
      isCurrent: month === currentMonth(),
    }),
    [month],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMonth(): MonthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMonth must be used within MonthProvider");
  return ctx;
}
