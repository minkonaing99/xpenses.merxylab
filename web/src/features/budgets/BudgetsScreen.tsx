import { useEffect, useMemo, useState } from "react";
import {
  useBudgets,
  useCategories,
  useCreateBudget,
  useDeleteBudget,
  useUpdateBudget,
} from "../../api/hooks";
import type { BudgetStatus, Category } from "../../api/types";
import { useMonth } from "../../app/MonthContext";
import { ApiError } from "../../lib/api";
import { budgetPace } from "../../lib/budgetPace";
import { bahtToSatang, formatSatang } from "../../lib/money";
import { Button } from "../../ui/Button";
import { Money } from "../../ui/Money";
import { MoneyInput } from "../../ui/MoneyInput";
import { MonthSwitcher } from "../../ui/MonthSwitcher";
import { PageHeader } from "../../ui/PageHeader";
import { Sheet } from "../../ui/Sheet";
import "../../ui/form.css";
import "./BudgetsScreen.css";

export function BudgetsScreen() {
  const { month } = useMonth();
  const categories = useCategories();
  const budgets = useBudgets(month);
  const [editCat, setEditCat] = useState<Category | null>(null);

  const byCat = useMemo(() => {
    const m = new Map<string, BudgetStatus>();
    (budgets.data ?? []).forEach((b) => m.set(b.categoryId, b));
    return m;
  }, [budgets.data]);

  return (
    <div className="buds">
      <PageHeader title="Budgets" back="/settings" action={<MonthSwitcher />} />

      <ul className="crud-list">
        {(categories.data ?? []).map((c) => {
          const b = byCat.get(c.id);
          const pct = b && b.limitAmount > 0 ? Math.min(100, (b.spent / b.limitAmount) * 100) : 0;
          const tone = b?.over ? "over" : pct >= 80 ? "warn" : "ok";
          return (
            <li key={c.id}>
              <button className="brow" onClick={() => setEditCat(c)}>
                <div className="brow__top">
                  <span className="brow__name">{c.name}</span>
                  {b ? (
                    <span className="brow__nums">
                      <Money amount={b.spent} tone={b.over ? "neg" : "ink"} className="num" />
                      <span className="brow__limit num"> / ฿{(b.limitAmount / 100).toLocaleString()}</span>
                    </span>
                  ) : (
                    <span className="brow__set">Set limit</span>
                  )}
                </div>
                {b && (
                  <div className="brow__track">
                    <span className={`brow__fill brow__fill--${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
                {b && <span className="brow__pace">{paceLabel(b, month)}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <BudgetForm
        category={editCat}
        existing={editCat ? byCat.get(editCat.id) ?? null : null}
        onClose={() => setEditCat(null)}
      />
    </div>
  );
}

// "฿480 left · ฿22/day" for the current month, "฿480 left" for others,
// "Over by ฿120" when past the limit.
function paceLabel(b: BudgetStatus, month: string): string {
  const { remaining, dailyPace } = budgetPace(b.limitAmount, b.spent, month);
  if (remaining < 0) return `Over by ฿${formatSatang(-remaining)}`;
  const left = `฿${formatSatang(remaining)} left`;
  return dailyPace !== null ? `${left} · ฿${formatSatang(dailyPace)}/day` : left;
}

function BudgetForm({
  category,
  existing,
  onClose,
}: {
  category: Category | null;
  existing: BudgetStatus | null;
  onClose: () => void;
}) {
  const create = useCreateBudget();
  const update = useUpdateBudget();
  const remove = useDeleteBudget();

  const [limit, setLimit] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!category) return;
    setErr(null);
    setLimit(existing ? (existing.limitAmount / 100).toString() : "");
  }, [category, existing]);

  const satang = bahtToSatang(limit);
  const valid = satang !== null && satang > 0;
  const busy = create.isPending || update.isPending || remove.isPending;

  async function save() {
    if (!valid || satang === null || !category) return;
    try {
      setErr(null);
      if (existing) await update.mutateAsync({ id: existing.id, limitAmount: satang });
      else
        await create.mutateAsync({
          id: crypto.randomUUID(),
          categoryId: category.id,
          limitAmount: satang,
        });
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't save.");
    }
  }

  async function del() {
    if (!existing) return;
    try {
      setErr(null);
      await remove.mutateAsync(existing.id);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't remove.");
    }
  }

  return (
    <Sheet open={!!category} onClose={onClose} title={category?.name ?? "Budget"}>
      <div className="aform">
        <label className="aform__field">
          <span className="fld__label">Monthly limit (฿)</span>
          <MoneyInput
            className="aform__input num"
            value={limit}
            onChange={setLimit}
            ariaLabel="Monthly limit in baht"
            autoFocus
          />
        </label>

        {err && (
          <p className="aform__error" role="alert">
            {err}
          </p>
        )}

        <Button block disabled={!valid || busy} onClick={save}>
          {busy ? "Saving…" : existing ? "Save limit" : "Set limit"}
        </Button>

        {existing && (
          <button className="aform__del" onClick={del} disabled={busy}>
            Remove budget
          </button>
        )}
      </div>
    </Sheet>
  );
}
