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
import { Segmented } from "../../ui/Segmented";
import { AddTransactionSheet } from "./AddTransactionSheet";
import { TransactionDetail } from "./TransactionDetail";
import {
  parseLedgerFilters,
  setLedgerFilter,
  type LedgerFilters,
} from "./ledgerFilters";
import "./TransactionsScreen.css";

type Filter = "all" | TxnType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
  { value: "transfer", label: "Transfers" },
];

export function TransactionsScreen() {
  const { month, setMonth } = useMonth();
  const [params, setParams] = useSearchParams();
  const urlFilters = parseLedgerFilters(params);
  const activeMonth = urlFilters.month ?? month;
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const txns = useTransactions(activeMonth, urlFilters);
  const accounts = useAccounts();
  const categories = useCategories();
  const wide = useMediaQuery("(min-width: 48rem) and (min-height: 40rem)");

  useEffect(() => {
    if (urlFilters.month && urlFilters.month !== month) setMonth(urlFilters.month);
  }, [month, setMonth, urlFilters.month]);

  function updateFilter(name: "type" | "accountId" | "categoryId", value: string | null) {
    setParams(setLedgerFilter(params, name, value));
  }

  const names = useMemo(() => {
    const acct = new Map<string, string>();
    (accounts.data ?? []).forEach((a: Account) => acct.set(a.id, a.name));
    const cat = new Map<string, string>();
    (categories.data ?? []).forEach((c: Category) => cat.set(c.id, c.name));
    return { acct, cat };
  }, [accounts.data, categories.data]);

  const filtered = useMemo(
    () => filterTxns(txns.data ?? [], query, urlFilters, names),
    [txns.data, query, urlFilters.type, urlFilters.accountId, urlFilters.categoryId, names],
  );
  const groups = useMemo(() => groupByDay(filtered), [filtered]);
  const hasFilters = !!(urlFilters.type || urlFilters.accountId || urlFilters.categoryId);

  useEffect(() => {
    if (!query.trim() || !txns.hasNextPage || txns.isFetchingNextPage) return;
    void txns.fetchNextPage();
  }, [query, txns.hasNextPage, txns.isFetchingNextPage, txns.fetchNextPage]);

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
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters{hasFilters ? ` (${[urlFilters.type, urlFilters.accountId, urlFilters.categoryId].filter(Boolean).length})` : ""}
        </button>
      </div>

      <FilterPanel
        open={filtersOpen}
        filters={urlFilters}
        accounts={accounts.data ?? []}
        categories={categories.data ?? []}
        onUpdate={updateFilter}
      />

      <FilterSummary
        filters={urlFilters}
        names={names}
        count={filtered.length}
        query={query}
        onRemove={updateFilter}
        onClear={clearFilters}
      />

      {txns.isLoading && <p className="ledger__note">Loading…</p>}

      {txns.isError && <p className="ledger__error" role="alert">Couldn't load transactions. Try again.</p>}

      {!txns.isLoading && !txns.isError && groups.length === 0 && (
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

function FilterPanel({
  open,
  filters,
  accounts,
  categories,
  onUpdate,
}: {
  open: boolean;
  filters: LedgerFilters;
  accounts: Account[];
  categories: Category[];
  onUpdate: (name: "type" | "accountId" | "categoryId", value: string | null) => void;
}) {
  const selected: Filter = filters.type ?? "all";
  return (
    <section className={`ledger__filter-panel${open ? " is-open" : ""}`} aria-label="Transaction filters">
      <div className="ledger__filters">
        <Segmented
          options={FILTERS}
          value={selected}
          onChange={(value) => onUpdate("type", value === "all" ? null : value)}
          label="Filter by type"
        />
      </div>
      <label className="ledger__select"><span>Account</span>
        <select value={filters.accountId ?? ""} onChange={(event) => onUpdate("accountId", event.target.value || null)}>
          <option value="">All accounts</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <label className="ledger__select"><span>Category</span>
        <select value={filters.categoryId ?? ""} onChange={(event) => onUpdate("categoryId", event.target.value || null)}>
          <option value="">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
    </section>
  );
}

function FilterSummary({ filters, names, count, query, onRemove, onClear }: {
  filters: LedgerFilters;
  names: { acct: Map<string, string>; cat: Map<string, string> };
  count: number;
  query: string;
  onRemove: (name: "type" | "accountId" | "categoryId", value: null) => void;
  onClear: () => void;
}) {
  const active = [filters.type, filters.accountId, filters.categoryId].filter(Boolean).length;
  if (!active && !query.trim()) return null;
  return <div className="ledger__filter-summary" aria-live="polite">
    <div className="ledger__active-filters">
      {filters.type && <button onClick={() => onRemove("type", null)} aria-label={`Remove type filter ${filters.type}`}>{filters.type}</button>}
      {filters.accountId && <button onClick={() => onRemove("accountId", null)} aria-label={`Remove account filter ${names.acct.get(filters.accountId) ?? "Unknown"}`}>{names.acct.get(filters.accountId) ?? "Unknown account"}</button>}
      {filters.categoryId && <button onClick={() => onRemove("categoryId", null)} aria-label={`Remove category filter ${names.cat.get(filters.categoryId) ?? "Unknown"}`}>{names.cat.get(filters.categoryId) ?? "Unknown category"}</button>}
    </div>
    <span>{count} {count === 1 ? "result" : "results"}</span>
    {active > 0 && <button className="ledger__clear" onClick={onClear} aria-label="Clear all filters">Clear all</button>}
  </div>;
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

// Client-side search + type filter over the loaded month.
function filterTxns(
  txns: Transaction[],
  query: string,
  filters: LedgerFilters,
  names: { acct: Map<string, string>; cat: Map<string, string> },
): Transaction[] {
  const q = query.trim().toLowerCase();
  return txns.filter((t) => {
    if (filters.type && t.type !== filters.type) return false;
    if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
    if (filters.accountId && ![t.accountId, t.fromAccountId, t.toAccountId].includes(filters.accountId)) return false;
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
  for (const t of [...txns].sort((a, b) => (a.txnDate < b.txnDate ? 1 : -1))) {
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
