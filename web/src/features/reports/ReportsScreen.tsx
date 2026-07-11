import { useCategorySpend, useSummary } from "../../api/hooks";
import { useMonth } from "../../app/MonthContext";
import { categoryColor } from "../../lib/categoryColor";
import { prevMonth } from "../../lib/format";
import { Donut } from "../../ui/Donut";
import { Money } from "../../ui/Money";
import { MonthSwitcher } from "../../ui/MonthSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import "./ReportsScreen.css";

export function ReportsScreen() {
  const { month } = useMonth();
  const summary = useSummary(month);
  const prev = useSummary(prevMonth(month));
  const spend = useCategorySpend(month);

  const s = summary.data;
  const items = [...(spend.data ?? [])].sort((a, b) => b.total - a.total);
  const total = items.reduce((sum, i) => sum + i.total, 0);
  const segments = items.map((i) => ({ value: i.total, color: categoryColor(i.categoryId) }));

  const expenseDelta = s && prev.data ? s.monthExpense - prev.data.monthExpense : null;

  return (
    <div className="reports">
      <PageHeader title="Reports" action={<MonthSwitcher />} />

      <section className="rcard">
        <div className="donut">
          <Donut segments={segments} />
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
          {items.map((i) => (
            <li key={i.categoryId} className="legend__row">
              <span className="legend__dot" style={{ background: categoryColor(i.categoryId) }} aria-hidden="true" />
              <span className="legend__name">{i.name}</span>
              <span className="legend__pct num">{total > 0 ? Math.round((i.total / total) * 100) : 0}%</span>
              <Money amount={i.total} className="legend__amt" />
            </li>
          ))}
        </ol>
      </section>

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
