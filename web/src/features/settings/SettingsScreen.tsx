import { useState } from "react";
import { Link } from "react-router-dom";
import { useLogout } from "../../api/hooks";
import { useMonth } from "../../app/MonthContext";
import { PageHeader } from "../../ui/PageHeader";
import "./SettingsScreen.css";

// Last calendar day of a YYYY-MM as YYYY-MM-DD.
function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(d).padStart(2, "0")}`;
}

const MANAGE = [
  { to: "/settings/accounts", label: "Accounts", desc: "Cash, bank, and other balances" },
  { to: "/settings/categories", label: "Categories", desc: "How expenses are grouped" },
  { to: "/settings/budgets", label: "Budgets", desc: "Monthly limits per category" },
  { to: "/settings/recurring", label: "Recurring", desc: "Auto-inserted transactions" },
];

export function SettingsScreen() {
  const logout = useLogout();
  const { month } = useMonth();
  const [from, setFrom] = useState(`${month}-01`);
  const [to, setTo] = useState(monthEnd(month));
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const exportHref = `/api/reports/export?from=${from}&to=${to}&format=${format}`;

  async function signOut() {
    await logout.mutateAsync().catch(() => {});
    location.reload();
  }

  return (
    <div className="settings">
      <PageHeader title="Settings" />

      <nav className="settings__list" aria-label="Manage">
        {MANAGE.map((m) => (
          <Link key={m.to} to={m.to} className="srow">
            <div className="srow__text">
              <span className="srow__label">{m.label}</span>
              <span className="srow__desc">{m.desc}</span>
            </div>
            <Chevron />
          </Link>
        ))}
      </nav>

      <section className="export" aria-label="Export">
        <h2 className="export__title">Export</h2>
        <div className="export__row">
          <label className="export__field">
            From
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="export__field">
            To
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        <div className="export__row">
          <label className="export__field">
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value as "csv" | "json")}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </label>
          <a className="settings__export" href={exportHref} download>
            Download {format.toUpperCase()}
          </a>
        </div>
      </section>

      <button className="settings__logout" onClick={signOut} disabled={logout.isPending}>
        {logout.isPending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
