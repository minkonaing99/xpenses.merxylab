import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccounts, useCategories, useTransactions } from "../../api/hooks";
import type { Account, Category, Transaction, TxnType } from "../../api/types";
import { shiftMonth, useMonth } from "../../app/MonthContext";
import { dayLabel } from "../../lib/format";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { Button } from "../../ui/Button";
import { Money } from "../../ui/Money";
import { MonthSwitcher } from "../../ui/MonthSwitcher";
import { AddTransactionSheet } from "./AddTransactionSheet";
import { LedgerFilterPanel } from "./LedgerFilterPanel";
import { TransactionDetail } from "./TransactionDetail";
import {
  parseLedgerFilters,
  setLedgerFilter,
  toggleLedgerListFilter,
  type LedgerFilters,
  type LedgerListFilter,
} from "./ledgerFilters";
import "./TransactionsScreen.css";

export function TransactionsScreen() {
  const { month, setMonth } = useMonth();
  const [params, setParams] = useSearchParams();
  const urlFilters = parseLedgerFilters(params);
  const activeMonth = urlFilters.month ?? month;
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const txns = useTransactions(activeMonth, { type: urlFilters.type });
  const accounts = useAccounts();
  const categories = useCategories();
  const wide = useMediaQuery("(min-width: 48rem) and (min-height: 40rem)");

  useEffect(() => {
    if (urlFilters.month && urlFilters.month !== month) setMonth(urlFilters.month);
  }, [month, setMonth, urlFilters.month]);

  function updateType(value: TxnType | null) {
    setParams(setLedgerFilter(params, "type", value));
  }

  function toggleListFilter(name: LedgerListFilter, value: string) {
    setParams(toggleLedgerListFilter(params, name, value));
  }

  const names = useMemo(() => {
    const acct = new Map<string, string>();
    (accounts.data ?? []).forEach((a: Account) => acct.set(a.id, a.name));
    const cat = new Map<string, string>();
    (categories.data ?? []).forEach((c: Category) => cat.set(c.id, c.name));
    return { acct, cat };
  }, [accounts.data, categories.data]);

  const accountFilterKey = urlFilters.accountIds.join(",");
  const categoryFilterKey = urlFilters.categoryIds.join(",");
  const hasListFilters = urlFilters.accountIds.length > 0 || urlFilters.categoryIds.length > 0;
  const hasFilters = !!urlFilters.type || hasListFilters;
  const isCompletingFilter = hasListFilters && (txns.hasNextPage || txns.isFetchingNextPage);
  const filtered = useMemo(
    () => filterTxns(txns.data ?? [], query, urlFilters, names),
    [txns.data, query, urlFilters.type, accountFilterKey, categoryFilterKey, names],
  );
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  useEffect(() => {
    if ((!query.trim() && !hasListFilters) || !txns.hasNextPage || txns.isFetchingNextPage) return;
    void txns.fetchNextPage();
  }, [query, hasListFilters, txns.hasNextPage, txns.isFetchingNextPage, txns.fetchNextPage]);

  useEffect(() => {
    if (!wide) return;
    const current = selected && filtered.find((transaction) => transaction.id === selected.id);
    setSelected(current ?? filtered[0] ?? null);
  }, [filtered, selected, wide]);

  function clearFilters() {
    const next = new URLSearchParams();
    if (urlFilters.month) next.set("month", urlFilters.month);
    setParams(next);
  }

  function changeMonth(delta: number) {
    const nextMonth = shiftMonth(activeMonth, delta);
    setMonth(nextMonth);
    setParams(setLedgerFilter(params, "month", nextMonth));
  }

  return (
    <div className="ledger">
      <header className="ledger__head">
        <h1 className="ledger__title">Transactions</h1>
        <MonthSwitcher onStep={changeMonth} />
      </header>

      <div className="ledger__tools">
        <input
          className="ledger__search"
          type="search"
          placeholder="Search notes, categories, accounts"
          aria-label="Search transactions"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="ledger__filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="ledger-filter-panel"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters{hasFilters ? ` (${filterCount(urlFilters)})` : ""}
        </button>
      </div>

      <LedgerFilterPanel
        open={filtersOpen}
        filters={urlFilters}
        accounts={accounts.data ?? []}
        categories={categories.data ?? []}
        onTypeChange={updateType}
        onListToggle={toggleListFilter}
      />

      <FilterSummary
        filters={urlFilters}
        names={names}
        count={filtered.length}
        query={query}
        onRemoveType={() => updateType(null)}
        onRemoveList={toggleListFilter}
        onClear={clearFilters}
      />

      {txns.isLoading && <p className="ledger__note">Loading…</p>}

      {txns.isError && <p className="ledger__error" role="alert">Couldn't load transactions. Try again.</p>}

      {!txns.isLoading && !txns.isError && isCompletingFilter && groups.length === 0 && (
        <p className="ledger__note">Finding matches...</p>
      )}

      {!txns.isLoading && !txns.isError && !isCompletingFilter && groups.length === 0 && (
        <div className="ledger__empty">
          <p className="ledger__empty-mark" aria-hidden="true">฿</p>
          <p className="ledger__empty-title">
            {query.trim() || hasFilters ? "No matches" : "No transactions yet"}
          </p>
          <p className="ledger__empty-sub">
            {query.trim() || hasFilters
              ? "Try a different search or filter."
              : "Tap the + below to log your first one."}
          </p>
        </div>
      )}

      <div className="ledger__workspace">
        <div className="ledger__list">
        {groups.map(([day, rows]) => (
          <section key={day} className="day">
          <div className="day__head">
            <h2 className="day__label">{day}</h2>
            <Money amount={dayNet(rows)} signed className="day__net" />
          </div>
          <ul className="day__list">
            {rows.map((t) => (
              <TxnRow key={t.id} t={t} names={names} selected={selected?.id === t.id}
                wide={wide}
                onOpen={() => wide ? setSelected(t) : setEditing(t)} />
            ))}
          </ul>
          </section>
        ))}
        </div>
        {wide && selected && <TransactionDetail transaction={selected} names={names} onEdit={() => setEditing(selected)} />}
      </div>

      {txns.hasNextPage && (
        <div className="ledger__more">
          <Button
            variant="ghost"
            disabled={txns.isFetchingNextPage}
            onClick={() => void txns.fetchNextPage()}
          >
            {txns.isFetchingNextPage ? "Loading..." : "Load older transactions"}
          </Button>
        </div>
      )}

      <AddTransactionSheet open={!!editing} editing={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function FilterSummary({ filters, names, count, query, onRemoveType, onRemoveList, onClear }: {
  filters: LedgerFilters;
  names: { acct: Map<string, string>; cat: Map<string, string> };
  count: number;
  query: string;
  onRemoveType: () => void;
  onRemoveList: (name: LedgerListFilter, value: string) => void;
  onClear: () => void;
}) {
  const active = filterCount(filters);
  if (!active && !query.trim()) return null;
  return <div className="ledger__filter-summary" aria-live="polite">
    <div className="ledger__active-filters">
      {filters.type && <button onClick={onRemoveType} aria-label={`Remove type filter ${filters.type}`}>{filters.type}</button>}
      {filters.accountIds.map((id) => <FilterChip key={id} kind="account" id={id}
        name={names.acct.get(id)} onRemove={() => onRemoveList("accountId", id)} />)}
      {filters.categoryIds.map((id) => <FilterChip key={id} kind="category" id={id}
        name={names.cat.get(id)} onRemove={() => onRemoveList("categoryId", id)} />)}
    </div>
    <span>{count} {count === 1 ? "result" : "results"}</span>
    {active > 0 && <button className="ledger__clear" onClick={onClear} aria-label="Clear all filters">Clear all</button>}
  </div>;
}

function FilterChip({ kind, id, name, onRemove }: {
  kind: "account" | "category";
  id: string;
  name?: string;
  onRemove: () => void;
}) {
  const label = name ?? `Unknown ${kind}`;
  return <button onClick={onRemove} aria-label={`Remove ${kind} filter ${name ?? "Unknown"}`}
    title={name ? undefined : id}>{label}</button>;
}

function filterCount(filters: LedgerFilters): number {
  return (filters.type ? 1 : 0) + filters.accountIds.length + filters.categoryIds.length;
}

function TxnRow({
  t,
  names,
  onOpen,
  selected,
  wide,
}: {
  t: Transaction;
  names: { acct: Map<string, string>; cat: Map<string, string> };
  onOpen: () => void;
  selected: boolean;
  wide: boolean;
}) {
  const catNm = names.cat.get(t.categoryId ?? "");
  const title =
    t.type === "transfer"
      ? `${names.acct.get(t.fromAccountId ?? "") ?? "?"} → ${names.acct.get(t.toAccountId ?? "") ?? "?"}`
      : t.note?.trim() || catNm || (t.type === "income" ? "Income" : "Expense");

  const sub =
    t.type === "transfer"
      ? "Transfer"
      : [catNm, names.acct.get(t.accountId ?? "")].filter(Boolean).join(" · ");

  return (
    <li className="txn-item">
      <button className={`txn${selected ? " is-selected" : ""}`} onClick={onOpen}
        aria-label={`${wide ? (selected ? "Selected" : "View details for") : "Edit"} ${title}`}
        aria-pressed={wide ? selected : undefined}>
        <div className="txn__meta">
          <span className="txn__title">{title}</span>
          {sub && <span className="txn__sub">{sub}</span>}
        </div>
        {t.type === "transfer" ? (
          <Money amount={t.amount} tone="ink" className="txn__amt" />
        ) : (
          <Money amount={t.type === "expense" ? -t.amount : t.amount} signed className="txn__amt" />
        )}
      </button>
    </li>
  );
}

// Client-side search and list filters over the loaded month.
function filterTxns(
  txns: Transaction[],
  query: string,
  filters: LedgerFilters,
  names: { acct: Map<string, string>; cat: Map<string, string> },
): Transaction[] {
  const q = query.trim().toLowerCase();
  const accountIds = new Set(filters.accountIds);
  const categoryIds = new Set(filters.categoryIds);
  return txns.filter((t) => {
    if (filters.type && t.type !== filters.type) return false;
    if (categoryIds.size > 0 && (!t.categoryId || !categoryIds.has(t.categoryId))) return false;
    const transactionAccounts = [t.accountId, t.fromAccountId, t.toAccountId].filter(Boolean) as string[];
    if (accountIds.size > 0 && !transactionAccounts.some((id) => accountIds.has(id))) return false;
    if (!q) return true;
    const parts = [
      t.note ?? "",
      names.cat.get(t.categoryId ?? "") ?? "",
      names.acct.get(t.accountId ?? "") ?? "",
      names.acct.get(t.fromAccountId ?? "") ?? "",
      names.acct.get(t.toAccountId ?? "") ?? "",
    ];
    return parts.join(" ").toLowerCase().includes(q);
  });
}

function groupByDay(txns: Transaction[]): Array<[string, Transaction[]]> {
  const byDate = new Map<string, Transaction[]>();
  for (const t of [...txns].sort((a, b) => b.txnDate.localeCompare(a.txnDate))) {
    const arr = byDate.get(t.txnDate) ?? [];
    byDate.set(t.txnDate, [...arr, t]);
  }
  return [...byDate.entries()].map(([date, rows]) => [dayLabel(date), rows]);
}

function dayNet(rows: Transaction[]): number {
  return rows.reduce((s, t) => {
    if (t.type === "expense") return s - t.amount;
    if (t.type === "income") return s + t.amount;
    return s;
  }, 0);
}
