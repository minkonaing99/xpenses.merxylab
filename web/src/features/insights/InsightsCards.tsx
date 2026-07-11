import { useState } from "react";
import type { Anomaly, Forecast } from "../../api/types";
import { Money } from "../../ui/Money";
import "./InsightsCards.css";

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long" });

function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return MONTH_LABEL.format(new Date(Date.UTC(y, m - 1, 1)));
}

interface ForecastCardProps {
  forecast: Forecast;
}

/** Recurring-aware month-end projection from the current burn rate. */
export function ForecastCard({ forecast: f }: ForecastCardProps) {
  if (f.daysRemaining === 0) return null; // month over — nothing to project
  return (
    <section className="fc">
      <div className="fc__head">
        <h2 className="fc__title">Month-end forecast</h2>
        <span className="fc__left">{f.daysRemaining} days left</span>
      </div>
      <div className="fc__net">
        <Money amount={f.projectedNet} signed className="fc__net-amt" />
        <span className="fc__net-cap">projected net for {monthName(f.month)}</span>
      </div>
      <div className="fc__grid">
        <div className="fc__cell">
          <span className="fc__k">Projected spend</span>
          <Money amount={f.projectedExpense} tone="neg" className="fc__v" />
        </div>
        <div className="fc__cell">
          <span className="fc__k">Spent so far</span>
          <Money amount={f.paidExpense} className="fc__v" />
        </div>
      </div>
    </section>
  );
}

function anomalyKey(a: Anomaly): string {
  return a.type === "duplicate" ? `duplicate:${a.ids.join("-")}` : `${a.type}:${a.categoryId}`;
}

function anomalyMessage(a: Anomaly): { icon: string; text: string } {
  switch (a.type) {
    case "budget_burn":
      return { icon: "!", text: `${a.name} is ${Math.round(a.pct * 100)}% through its budget` };
    case "category_velocity":
      return { icon: "↑", text: `${a.name} spending is running above its usual pace` };
    case "duplicate":
      return { icon: "⧉", text: `Possible duplicate in ${a.name ?? "an expense"}` };
  }
}

function useDismissed(month: string): { dismissed: Set<string>; dismiss: (k: string) => void } {
  const storeKey = `xpenses.dismissedAnomalies.${month}`;
  const store = typeof window !== "undefined" ? window.localStorage : undefined;
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(store?.getItem(storeKey) ?? "[]") as string[]);
    } catch {
      return new Set();
    }
  });
  const dismiss = (k: string) =>
    setDismissed((prev) => {
      const next = new Set(prev).add(k);
      try {
        store?.setItem(storeKey, JSON.stringify([...next]));
      } catch {
        // storage full/unavailable — dismissal is still honored for this session
      }
      return next;
    });
  return { dismissed, dismiss };
}

interface AnomalyCardsProps {
  month: string;
  anomalies: Anomaly[];
}

/** Dismissible heads-up cards. Dismissed state is per-month in localStorage. */
export function AnomalyCards({ month, anomalies }: AnomalyCardsProps) {
  const { dismissed, dismiss } = useDismissed(month);
  const visible = anomalies.filter((a) => !dismissed.has(anomalyKey(a)));
  if (visible.length === 0) return null;

  return (
    <section className="anoms" aria-label="Insights">
      {visible.map((a) => {
        const key = anomalyKey(a);
        const { icon, text } = anomalyMessage(a);
        return (
          <div key={key} className={`anom anom--${a.type}`}>
            <span className="anom__icon" aria-hidden="true">
              {icon}
            </span>
            <span className="anom__text">{text}</span>
            <button className="anom__x" onClick={() => dismiss(key)} aria-label="Dismiss">
              ×
            </button>
          </div>
        );
      })}
    </section>
  );
}
