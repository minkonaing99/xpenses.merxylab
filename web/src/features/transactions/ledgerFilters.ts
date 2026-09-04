import type { TxnType } from "../../api/types";

export interface LedgerFilters {
  month: string | null;
  type: TxnType | null;
  accountId: string | null;
  categoryId: string | null;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set<TxnType>(["expense", "income", "transfer"]);

export function parseLedgerFilters(params: URLSearchParams): LedgerFilters {
  const month = params.get("month");
  const type = params.get("type") as TxnType | null;
  const accountId = params.get("accountId");
  const categoryId = params.get("categoryId");
  return {
    month: month && MONTH.test(month) ? month : null,
    type: type && TYPES.has(type) ? type : null,
    accountId: accountId && UUID.test(accountId) ? accountId : null,
    categoryId: categoryId && UUID.test(categoryId) ? categoryId : null,
  };
}

export function setLedgerFilter(
  params: URLSearchParams,
  name: keyof LedgerFilters,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(name, value);
  else next.delete(name);
  return next;
}
