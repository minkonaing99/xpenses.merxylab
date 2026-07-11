// Domain types mirroring the API. Money fields are integer satang.

export type TxnType = "expense" | "income" | "transfer";
export type AccountType = "cash" | "bank" | "other";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  startingBalance: number;
  balance: number; // computed current balance (satang)
}

export interface Category {
  id: string;
  name: string;
  icon?: string | null;
}

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number; // satang, always > 0
  note?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  txnDate: string; // YYYY-MM-DD
  updatedAt: string; // ISO datetime
}

export interface BudgetStatus {
  id: string;
  categoryId: string;
  limitAmount: number; // satang
  spent: number; // satang
  over: boolean;
}

export type IntervalUnit = "day" | "week" | "month";

export interface RecurringRule {
  id: string;
  type: TxnType;
  amount: number; // satang
  note?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  nextRunDate: string; // YYYY-MM-DD
  active: boolean;
}

export interface CategorySpend {
  categoryId: string;
  name: string;
  total: number; // satang
}

export interface Summary {
  accounts: Account[];
  monthIncome: number; // satang
  monthExpense: number; // satang
  monthNet: number; // satang, income - expense this month
}
