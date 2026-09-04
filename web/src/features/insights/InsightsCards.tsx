import { useState } from "react";
import type { Anomaly } from "../../api/types";
import "./InsightsCards.css";

function anomalyKey(a: Anomaly): string {
  return `${a.type}:${a.categoryId}`;
}

function anomalyMessage(a: Anomaly): { icon: string; text: string } {
  switch (a.type) {
    case "budget_burn":
      return { icon: "!", text: `${a.name} is ${Math.round(a.pct * 100)}% through its budget` };
    case "category_velocity":
      return { icon: "↑", text: `${a.name} spending is running above its usual pace` };
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
