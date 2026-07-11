import { useMonth } from "../app/MonthContext";
import { monthLabel } from "../lib/format";
import "./MonthSwitcher.css";

export function MonthSwitcher() {
  const { month, step, isCurrent } = useMonth();
  return (
    <div className="msw">
      <button className="msw__nav" onClick={() => step(-1)} aria-label="Previous month">
        <Chevron dir="left" />
      </button>
      <span className="msw__label num">{monthLabel(month)}</span>
      <button
        className="msw__nav"
        onClick={() => step(1)}
        disabled={isCurrent}
        aria-label="Next month"
      >
        <Chevron dir="right" />
      </button>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}
