import { useMemo, useState } from "react";
import { useAccounts, useCategories, useTransactions } from "../../api/hooks";
import type { Account, Category, Transaction, TxnType } from "../../api/types";
import { useMonth } from "../../app/MonthContext";
import { dayLabel } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Money } from "../../ui/Money";
import { MonthSwitcher } from "../../ui/MonthSwitcher";
import { AddTransactionSheet } from "./AddTransactionSheet";
import "./TransactionsScreen.css";

type Filter = "all" | TxnType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expenses" },
  { value: "transfer", label: "Transfers" },
];

export function TransactionsScreen() {
  const { month } = useMonth();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const txns = useTransactions(month);
  const accounts = useAccounts();
  const categories = useCategories();

  const names = useMemo(() => {
    const acct = new Map<string, string>();
    (accounts.data ?? []).forEach((a: Account) => acct.set(a.id, a.name));
    const cat = new Map<string, string>();
    (categories.data ?? []).forEach((c: Category) => cat.set(c.id, c.name));
    return { acct, cat };
  }, [accounts.data, categories.data]);

  const filtered = useMemo(
    () => filterTxns(txns.data ?? [], query, filter, names),
    [txns.data, query, filter, names],
  );
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="ledger">
      <header className="ledger__head">
        <h1 className="ledger__title">Transactions</h1>
        <MonthSwitcher />
      </header>

      <input
        className="ledger__search"
        type="search"
        placeholder="Search notes, categories, accounts"
        aria-label="Search transactions"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="ledger__filters" role="tablist" aria-label="Filter by type">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="tab"
            aria-selected={filter === f.value}
            className={`chip${filter === f.value ? " chip--on" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {txns.isLoading && <p className="ledger__note">Loading…</p>}

      {txns.isError && <p className="ledger__error" role="alert">Couldn't load transactions. Try again.</p>}

      {!txns.isLoading && !txns.isError && groups.length === 0 && (
        <div className="ledger__empty">
          <p className="ledger__empty-mark" aria-hidden="true">฿</p>
          <p className="ledger__empty-title">
            {query.trim() || filter !== "all" ? "No matches" : "No transactions yet"}
          </p>
          <p className="ledger__empty-sub">
            {query.trim() || filter !== "all"
              ? "Try a different search or filter."
              : "Tap the + below to log your first one."}
          </p>
        </div>
      )}

      {groups.map(([day, rows]) => (
        <section key={day} className="day">
          <div className="day__head">
            <h2 className="day__label">{day}</h2>
            <Money amount={dayNet(rows)} signed className="day__net" />
          </div>
          <ul className="day__list">
            {rows.map((t) => (
              <TxnRow key={t.id} t={t} names={names} onOpen={() => setEditing(t)} />
            ))}
          </ul>
        </section>
      ))}

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

function TxnRow({
  t,
  names,
  onOpen,
}: {
  t: Transaction;
  names: { acct: Map<string, string>; cat: Map<string, string> };
  onOpen: () => void;
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
      <button className="txn" onClick={onOpen} aria-label={`Edit ${title}`}>
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
  filter: Filter,
  names: { acct: Map<string, string>; cat: Map<string, string> },
): Transaction[] {
  const q = query.trim().toLowerCase();
  return txns.filter((t) => {
    if (filter !== "all" && t.type !== filter) return false;
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
