import { Link } from "react-router-dom";
import { useLogout } from "../../api/hooks";
import { useMonth } from "../../app/MonthContext";
import { PageHeader } from "../../ui/PageHeader";
import "./SettingsScreen.css";

const MANAGE = [
  { to: "/settings/accounts", label: "Accounts", desc: "Cash, bank, and other balances" },
  { to: "/settings/categories", label: "Categories", desc: "How expenses are grouped" },
  { to: "/settings/budgets", label: "Budgets", desc: "Monthly limits per category" },
  { to: "/settings/recurring", label: "Recurring", desc: "Auto-inserted transactions" },
];

export function SettingsScreen() {
  const logout = useLogout();
  const { month } = useMonth();

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

      <button className="settings__logout" onClick={signOut} disabled={logout.isPending}>
        {logout.isPending ? "Signing out…" : "Sign out"}
      </button>

      <a className="settings__export" href={`/api/reports/export?month=${month}`} download>
        Export {month} as CSV
      </a>
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
