import { useState } from "react";
import { useRecurring, useUpdateRecurring } from "../../api/hooks";
import type { RecurringRule } from "../../api/types";
import { Money } from "../../ui/Money";
import { Button } from "../../ui/Button";
import { PageHeader } from "../../ui/PageHeader";
import { RecurringForm } from "./RecurringForm";
import "../../ui/form.css";
import "./RecurringScreen.css";

export function RecurringScreen() {
  const rules = useRecurring();
  const toggle = useUpdateRecurring();
  const [form, setForm] = useState<RecurringRule | "new" | null>(null);

  return (
    <div className="rec">
      <PageHeader
        title="Recurring"
        back="/settings"
        action={
          <Button variant="ghost" className="crud-add" onClick={() => setForm("new")}>
            Add
          </Button>
        }
      />

      {(rules.data ?? []).length === 0 && !rules.isLoading && (
        <p className="rec__empty">No rules yet. Add one to auto-insert transactions.</p>
      )}

      <ul className="crud-list">
        {(rules.data ?? []).map((r) => (
          <li key={r.id} className="rrow">
            <button className="rrow__main" onClick={() => setForm(r)}>
              <div className="rrow__text">
                <span className="rrow__title">{r.note?.trim() || labelType(r.type)}</span>
                <span className="rrow__meta">
                  {cadence(r)} · next {r.nextRunDate}
                </span>
              </div>
              <Money amount={r.amount} className="rrow__amt" />
            </button>
            <button
              className={`rrow__toggle${r.active ? " is-on" : ""}`}
              role="switch"
              aria-checked={r.active}
              aria-label={r.active ? "Pause rule" : "Resume rule"}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: r.id, patch: { active: !r.active } })}
            >
              <span className="rrow__knob" />
            </button>
          </li>
        ))}
      </ul>

      <RecurringForm target={form} onClose={() => setForm(null)} />
    </div>
  );
}

function labelType(t: RecurringRule["type"]): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function cadence(r: RecurringRule): string {
  const n = r.intervalCount;
  return n === 1 ? `Every ${r.intervalUnit}` : `Every ${n} ${r.intervalUnit}s`;
}
