import { useMemo } from "react";
import { useCategorySpend, useComparisons, useSummary } from "../../api/hooks";
import type { Comparison } from "../../api/types";
import { useMonth } from "../../app/MonthContext";
import { prevMonth } from "../../lib/format";
import { Heatmap } from "./Heatmap";
import { Donut } from "../../ui/Donut";
import { Money } from "../../ui/Money";
import { MonthSwitcher } from "../../ui/MonthSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import "./ReportsScreen.css";

// Violet-shade ramp: darkest for the biggest slice, lighter down the list.
// Keeps the chart on-theme while still telling segments apart.
function shade(index: number, count: number): string {
  const l = count > 1 ? 0.52 + (index / (count - 1)) * 0.24 : 0.55;
  return `oklch(${l.toFixed(3)} 0.16 288)`;
}

export function ReportsScreen() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const prev = useSummary(prevMonth(month));
  const spend = useCategorySpend(month);

  const comparisons = useComparisons(month);
  const cmpByCat = useMemo(() => {
    const m = new Map<string, Comparison>();
    (comparisons.data ?? []).forEach((c) => m.set(c.categoryId, c));
    return m;
  }, [comparisons.data]);

  const s = summary.data;
  const items = [...(spend.data ?? [])].sort((a, b) => b.total - a.total);
  const total = items.reduce((sum, i) => sum + i.total, 0);
  const segments = items.map((i, idx) => ({ value: i.total, color: shade(idx, items.length) }));

  const expenseDelta = s && prev.data ? s.monthExpense - prev.data.monthExpense : null;

  return (
    <div className="reports">
      <PageHeader title="Reports" action={<MonthSwitcher />} />

      <section className="rcard">
        <div className="donut">
          <Donut segments={segments} thickness={16} />
          <div className="donut__center">
            <Money amount={total} className="donut__total" />
            <span className="donut__cap">Total spent</span>
          </div>
        </div>

        {expenseDelta !== null && (
          <p className="rmom">
            {expenseDelta === 0 ? (
              "Flat vs last month"
            ) : (
              <>
                {expenseDelta > 0 ? "▲" : "▼"}{" "}
                <Money amount={Math.abs(expenseDelta)} tone={expenseDelta > 0 ? "neg" : "pos"} className="rmom__amt" />{" "}
                vs last month
              </>
            )}
          </p>
        )}
      </section>

      <div className="rstats">
        <Stat label="In" amount={s?.monthIncome ?? 0} tone="pos" />
        <Stat label="Out" amount={s?.monthExpense ?? 0} tone="neg" />
        <Stat label="Net" amount={s?.monthNet ?? 0} signed />
      </div>

      <section className="rcard">
        <h2 className="rcard__title">By category</h2>
        {items.length === 0 && <p className="rcard__empty">Nothing spent this month.</p>}
        <ol className="legend">
          {items.map((i, idx) => (
            <li key={i.categoryId} className="legend__row">
              <span className="legend__dot" style={{ background: shade(idx, items.length) }} aria-hidden="true" />
              <span className="legend__name">{i.name}</span>
              <TrendChip cmp={cmpByCat.get(i.categoryId)} />
              <span className="legend__pct num">{total > 0 ? Math.round((i.total / total) * 100) : 0}%</span>
              <Money amount={i.total} className="legend__amt" />
            </li>
          ))}
        </ol>
      </section>

      <Heatmap />

      <section className="rcard">
        <h2 className="rcard__title">Accounts</h2>
        {(s?.accounts ?? []).map((a) => (
          <div key={a.id} className="rbal">
            <span className="rbal__name">{a.name}</span>
            <Money amount={a.balance} className="rbal__amt" />
          </div>
        ))}
      </section>
    </div>
  );
}

// vs last month. Spending more (up) is the "bad" direction for an expense,
// so up = neg tint, down = pos tint. Hidden when there is no prior baseline.
function TrendChip({ cmp }: { cmp?: Comparison }) {
  if (!cmp || cmp.last === 0 || cmp.vsLast === 0) return null;
  const up = cmp.vsLast > 0;
  return (
    <span className={`trend trend--${up ? "up" : "down"}`} title="vs last month">
      {up ? "▲" : "▼"} {Math.abs(Math.round(cmp.vsLast / 100)).toLocaleString()}
    </span>
  );
}

function Stat({
  label,
  amount,
  tone,
  signed,
}: {
  label: string;
  amount: number;
  tone?: "pos" | "neg";
  signed?: boolean;
}) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <Money amount={amount} tone={tone} signed={signed} className="stat__amt" />
    </div>
  );
}
