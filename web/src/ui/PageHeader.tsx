import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import "./PageHeader.css";

interface Props {
  title: string;
  back?: string; // route to go back to; omit for top-level screens
  action?: ReactNode;
}

export function PageHeader({ title, back, action }: Props) {
  const nav = useNavigate();
  return (
    <header className="ph">
      {back && (
        <button className="ph__back" onClick={() => nav(back)} aria-label="Back">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}
      <h1 className="ph__title">{title}</h1>
      {action && <div className="ph__action">{action}</div>}
    </header>
  );
}
