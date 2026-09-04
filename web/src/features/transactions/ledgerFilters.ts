import type { TxnType } from "../../api/types";

export interface LedgerFilters {
  month: string | null;
  type: TxnType | null;
  accountIds: readonly string[];
  categoryIds: readonly string[];
}

export type LedgerListFilter = "accountId" | "categoryId";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set<TxnType>(["expense", "income", "transfer"]);

export function parseLedgerFilters(params: URLSearchParams): LedgerFilters {
  const month = params.get("month");
  const type = params.get("type") as TxnType | null;
  return {
    month: month && MONTH.test(month) ? month : null,
    type: type && TYPES.has(type) ? type : null,
    accountIds: validIds(params, "accountId"),
    categoryIds: validIds(params, "categoryId"),
  };
}

export function setLedgerFilter(
  params: URLSearchParams,
  name: "month" | "type",
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value) next.set(name, value);
  else next.delete(name);
  return next;
}

export function toggleLedgerListFilter(
  params: URLSearchParams,
  name: LedgerListFilter,
  value: string,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (!UUID.test(value)) return next;
  const current = validIds(params, name);
  const values = current.includes(value)
    ? current.filter((id) => id !== value)
    : [...current, value];
  next.delete(name);
  values.forEach((id) => next.append(name, id));
  return next;
}

function validIds(params: URLSearchParams, name: LedgerListFilter): string[] {
  return [...new Set(params.getAll(name).filter((id) => UUID.test(id)))];
}
