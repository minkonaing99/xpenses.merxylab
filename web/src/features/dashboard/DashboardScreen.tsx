import { useMemo, type ReactNode } from "react";
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
import { LogoMark, Wordmark } from "../../ui/Logo";
import { Money } from "../../ui/Money";
import { MonthSwitcher } from "../../ui/MonthSwitcher";
import "./DashboardScreen.css";

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

  const stageRef = useEntrance<HTMLDivElement>();

  return (
    <div className="dash" ref={stageRef}>
      <header className="dash__hero">
        <div className="dash__brandrow">
          <span className="dash__brand">
            <LogoMark size={22} />
            <Wordmark />
          </span>
          <div className="dash__month">
            <MonthSwitcher />
          </div>
        </div>
        <p className="dash__net-label">Net balance</p>
        <AnimatedMoney amount={netWorth} className="dash__net" />
        <p className="dash__flow">
          <span>
            Spent <Money amount={spent} tone="neg" className="dash__flow-num" />
          </span>
          <span className="dash__flow-dot" aria-hidden="true">·</span>
          <span>
            In <Money amount={income} tone="pos" className="dash__flow-num" />
          </span>
        </p>
      </header>

      <section className="dash__accounts" aria-label="Accounts">
        {(accounts.data ?? []).map((a) => (
          <div key={a.id} className="acct">
            <span className="acct__name">{a.name}</span>
            <Money amount={a.balance} className="acct__bal" />
          </div>
        ))}
        {accounts.isLoading && <RowSkeleton n={2} />}
      </section>

      <Section title="Budgets" empty={(budgets.data ?? []).length === 0} emptyText="No budgets set.">
        {(budgets.data ?? []).map((b) => (
          <BudgetRow key={b.categoryId} b={b} name={catName.get(b.categoryId) ?? "Category"} />
        ))}
      </Section>

      <Section
        title="Where it went"
        empty={(spend.data ?? []).length === 0}
        emptyText="Nothing spent yet this month."
      >
        <SpendList items={spend.data ?? []} />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  empty,
  emptyText,
}: {
  title: string;
  children: ReactNode;
  empty: boolean;
  emptyText: string;
}) {
  return (
    <section className="sec">
      <h2 className="sec__title">{title}</h2>
      {empty ? <p className="sec__empty">{emptyText}</p> : children}
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
  const max = Math.max(1, ...items.map((i) => i.total));
  const total = items.reduce((s, i) => s + i.total, 0);
  return (
    <ol className="spend">
      {[...items]
        .sort((a, b) => b.total - a.total)
        .map((i) => (
          <li key={i.categoryId} className="spend__row">
            <div className="spend__meta">
              <span className="spend__name">{i.name}</span>
              <span className="spend__share num">
                {total > 0 ? Math.round((i.total / total) * 100) : 0}%
              </span>
            </div>
            <div className="spend__bar-wrap">
              <span className="spend__bar" style={{ width: `${(i.total / max) * 100}%` }} />
              <Money amount={i.total} className="spend__amt" />
            </div>
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
