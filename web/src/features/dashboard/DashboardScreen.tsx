import { useMemo, useState, type ReactNode } from "react";
import {
  useAccounts,
  useBudgets,
  useCategories,
  useCategorySpend,
  useSummary,
} from "../../api/hooks";
import type { BudgetStatus, Category, CategorySpend } from "../../api/types";
import { useMonth } from "../../app/MonthContext";
import { useEntrance } from "../../lib/useEntrance";
import { AnimatedMoney } from "../../ui/AnimatedMoney";
import { CategoryIcon } from "../../ui/CategoryIcon";
import { LogoMark } from "../../ui/Logo";
import { Money } from "../../ui/Money";
import { MonthSwitcher } from "../../ui/MonthSwitcher";
import { Sparkline } from "../../ui/Sparkline";
import "./DashboardScreen.css";

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardScreen() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const accounts = useAccounts();
  const budgets = useBudgets(month);
  const categories = useCategories();
  const spend = useCategorySpend(month);

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    (categories.data ?? []).forEach((c: Category) => m.set(c.id, c.name));
    return m;
  }, [categories.data]);

  const netWorth = (accounts.data ?? []).reduce((s, a) => s + a.balance, 0);
  const spent = summary.data?.monthExpense ?? 0;
  const income = summary.data?.monthIncome ?? 0;
  const net = summary.data?.monthNet ?? 0;

  const stageRef = useEntrance<HTMLDivElement>();
  const [shown, setShown] = useState(false);

  return (
    <div className="dash" ref={stageRef}>
      <header className="dash__top">
        <div>
          <p className="dash__hi">{greeting()}</p>
          <h1 className="dash__greet">Your overview</h1>
        </div>
        <span className="dash__logo">
          <LogoMark size={26} />
        </span>
      </header>

      <section className="hero">
        <div className="hero__head">
          <span className="hero__label">Total balance</span>
          <MonthSwitcher />
        </div>
        <button
          className="hero__amount-btn"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide balance" : "Show balance"}
        >
          {shown ? (
            <AnimatedMoney amount={netWorth} className="hero__amount" color="#fff" />
          ) : (
            <span className="hero__amount hero__amount--masked" aria-hidden="true">
              ฿ ∗∗∗∗∗∗
            </span>
          )}
        </button>
        <p className="hero__delta">
          {net >= 0 ? "▲" : "▼"} <Money amount={Math.abs(net)} className="hero__delta-num" /> net this month
        </p>
        <div className="hero__spark">
          <Sparkline stroke="rgba(255,255,255,0.9)" strokeWidth={3} />
        </div>
      </section>

      <section className="ov">
        <OvRow glyph="↓" color="var(--pos)" label="Income" amount={income} tone="pos" />
        <OvRow glyph="↑" color="var(--neg)" label="Expenses" amount={spent} tone="neg" />
        <OvRow glyph="≈" color="var(--accent)" label="Net" amount={net} signed />
      </section>

      <Card title="Accounts">
        {(accounts.data ?? []).map((a) => (
          <div key={a.id} className="acct">
            <span className="acct__name">{a.name}</span>
            <Money amount={a.balance} className="acct__bal" />
          </div>
        ))}
        {accounts.isLoading && <RowSkeleton n={2} />}
      </Card>

      <Card title="Budgets" empty={(budgets.data ?? []).length === 0} emptyText="No budgets set.">
        {(budgets.data ?? []).map((b) => (
          <BudgetRow key={b.categoryId} b={b} name={catName.get(b.categoryId) ?? "Category"} />
        ))}
      </Card>

      <Card
        title="Where it went"
        empty={(spend.data ?? []).length === 0}
        emptyText="Nothing spent yet this month."
      >
        <SpendList items={spend.data ?? []} />
      </Card>
    </div>
  );
}

function OvRow({
  glyph,
  color,
  label,
  amount,
  tone,
  signed,
}: {
  glyph: string;
  color: string;
  label: string;
  amount: number;
  tone?: "pos" | "neg";
  signed?: boolean;
}) {
  return (
    <div className="ovrow">
      <span className="ovrow__icon" style={{ background: color }} aria-hidden="true">
        {glyph}
      </span>
      <span className="ovrow__label">{label}</span>
      <Money amount={amount} tone={tone} signed={signed} className="ovrow__amt" />
    </div>
  );
}

function Card({
  title,
  children,
  empty,
  emptyText,
}: {
  title: string;
  children: ReactNode;
  empty?: boolean;
  emptyText?: string;
}) {
  return (
    <section className="card">
      <h2 className="card__title">{title}</h2>
      {empty ? <p className="card__empty">{emptyText}</p> : children}
    </section>
  );
}

function BudgetRow({ b, name }: { b: BudgetStatus; name: string }) {
  const pct = b.limitAmount > 0 ? Math.min(100, Math.round((b.spent / b.limitAmount) * 100)) : 0;
  const tone = b.over ? "over" : pct >= 80 ? "warn" : "ok";
  return (
    <div className="bud">
      <div className="bud__top">
        <span className="bud__name">{name}</span>
        <span className={`bud__nums bud__nums--${tone}`}>
          <Money amount={b.spent} className="bud__spent" />
          <span className="bud__limit num"> / ฿{(b.limitAmount / 100).toLocaleString()}</span>
        </span>
      </div>
      <div className="bud__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className={`bud__fill bud__fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SpendList({ items }: { items: CategorySpend[] }) {
  const total = items.reduce((s, i) => s + i.total, 0);
  return (
    <ol className="spend">
      {[...items]
        .sort((a, b) => b.total - a.total)
        .map((i) => (
          <li key={i.categoryId} className="spend__row">
            <CategoryIcon id={i.categoryId} name={i.name} size={38} />
            <div className="spend__meta">
              <span className="spend__name">{i.name}</span>
              <span className="spend__share num">
                {total > 0 ? Math.round((i.total / total) * 100) : 0}%
              </span>
            </div>
            <Money amount={i.total} className="spend__amt" />
          </li>
        ))}
    </ol>
  );
}

function RowSkeleton({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="acct acct--skel" aria-hidden="true" />
      ))}
    </>
  );
}
