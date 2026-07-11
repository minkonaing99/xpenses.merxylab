import { useCategorySpend, useSummary } from "../../api/hooks";
import { useMonth } from "../../app/MonthContext";
import { prevMonth } from "../../lib/format";
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
  const max = Math.max(1, ...items.map((i) => i.total));
  const total = items.reduce((sum, i) => sum + i.total, 0);

  // Month-over-month spend delta (this month's expense minus last month's).
  const expenseDelta =
    s && prev.data ? s.monthExpense - prev.data.monthExpense : null;

  return (
    <div className="reports">
      <PageHeader title="Reports" action={<MonthSwitcher />} />

      <div className="rstats">
        <Stat label="In" amount={s?.monthIncome ?? 0} tone="pos" />
        <Stat label="Out" amount={s?.monthExpense ?? 0} tone="neg" />
        <Stat label="Net" amount={s?.monthNet ?? 0} signed />
      </div>

      {expenseDelta !== null && (
        <p className="rmom">
          Spending{" "}
          {expenseDelta === 0 ? (
            "is flat vs last month"
          ) : (
            <>
              {expenseDelta > 0 ? "up" : "down"}{" "}
              <Money amount={Math.abs(expenseDelta)} tone={expenseDelta > 0 ? "neg" : "pos"} className="rmom__amt" />{" "}
              vs last month
            </>
          )}
        </p>
      )}

      <section className="rsec">
        <h2 className="rsec__title">Accounts</h2>
        {(s?.accounts ?? []).map((a) => (
          <div key={a.id} className="rbal">
            <span className="rbal__name">{a.name}</span>
            <Money amount={a.balance} className="rbal__amt" />
          </div>
        ))}
      </section>

      <section className="rsec">
        <h2 className="rsec__title">Spending by category</h2>
        {items.length === 0 && <p className="rsec__empty">Nothing spent this month.</p>}
        <ol className="rspend">
          {items.map((i) => (
            <li key={i.categoryId} className="rspend__row">
              <div className="rspend__meta">
                <span className="rspend__name">{i.name}</span>
                <span className="rspend__vals">
                  <Money amount={i.total} className="rspend__amt" />
                  <span className="rspend__pct num">
                    {total > 0 ? Math.round((i.total / total) * 100) : 0}%
                  </span>
                </span>
              </div>
              <span className="rspend__bar" style={{ width: `${(i.total / max) * 100}%` }} />
            </li>
          ))}
        </ol>
      </section>

      <a className="rexport" href={`/api/reports/export?month=${month}`} download>
        Export {month} as CSV
      </a>
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
