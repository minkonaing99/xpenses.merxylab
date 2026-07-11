// Pure budget-pace math. All money is integer satang.
import { currentMonth } from "./format";

export interface BudgetPace {
  remaining: number; // satang, negative when over limit
  daysLeft: number; // inclusive of today; 0 for a non-current month
  dailyPace: number | null; // satang/day you can still spend; null when N/A
}

/** Days remaining in a YYYY-MM including today, in Bangkok time. 0 if it's not the current month. */
export function daysLeftInMonth(month: string, now = new Date()): number {
  if (month !== currentMonth(now)) return 0;
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", day: "2-digit" }).format(now),
  );
  return daysInMonth - today + 1;
}

export function budgetPace(limit: number, spent: number, month: string, now = new Date()): BudgetPace {
  const remaining = limit - spent;
  const daysLeft = daysLeftInMonth(month, now);
  const dailyPace = daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : null;
  return { remaining, daysLeft, dailyPace };
}
