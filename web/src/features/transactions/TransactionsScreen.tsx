import { useMemo, useState } from "react";
import { useAccounts, useCategories, useTransactions } from "../../api/hooks";
import type { Account, Category, Transaction } from "../../api/types";
import { useMonth } from "../../app/MonthContext";
import { dayLabel } from "../../lib/format";
import { Money } from "../../ui/Money";
import { MonthSwitcher } from "../../ui/MonthSwitcher";
import { AddTransactionSheet } from "./AddTransactionSheet";
import "./TransactionsScreen.css";

export function TransactionsScreen() {
  const { month } = useMonth();
  const [editing, setEditing] = useState<Transaction | null>(null);
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

  const groups = useMemo(() => groupByDay(txns.data ?? []), [txns.data]);

  return (
    <div className="ledger">
      <header className="ledger__head">
        <h1 className="ledger__title">Ledger</h1>
        <MonthSwitcher />
      </header>

      {txns.isLoading && <p className="ledger__note">Loading…</p>}

      {!txns.isLoading && groups.length === 0 && (
        <div className="ledger__empty">
          <p className="ledger__empty-mark" aria-hidden="true">฿</p>
          <p className="ledger__empty-title">No transactions yet</p>
          <p className="ledger__empty-sub">Tap the + below to log your first one.</p>
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
  const title =
    t.type === "transfer"
      ? `${names.acct.get(t.fromAccountId ?? "") ?? "?"} → ${names.acct.get(t.toAccountId ?? "") ?? "?"}`
      : t.note?.trim() || names.cat.get(t.categoryId ?? "") || (t.type === "income" ? "Income" : "Expense");

  const sub =
    t.type === "transfer"
      ? "Transfer"
      : [names.cat.get(t.categoryId ?? ""), names.acct.get(t.accountId ?? "")].filter(Boolean).join(" · ");

  return (
    <li className="txn-item">
      <button className="txn" onClick={onOpen} aria-label={`Edit ${title}`}>
        <span className={`txn__dot txn__dot--${t.type}`} aria-hidden="true" />
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
