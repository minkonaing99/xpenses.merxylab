import { useEffect, useState } from "react";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "../../api/hooks";
import type { Category } from "../../api/types";
import { ApiError } from "../../lib/api";
import { Button } from "../../ui/Button";
import { PageHeader } from "../../ui/PageHeader";
import { Sheet } from "../../ui/Sheet";
import "../../ui/form.css";
import "./CategoriesScreen.css";

export function CategoriesScreen() {
  const categories = useCategories();
  const [form, setForm] = useState<Category | "new" | null>(null);

  return (
    <div className="cats">
      <PageHeader
        title="Categories"
        back="/settings"
        action={
          <Button variant="ghost" className="crud-add" onClick={() => setForm("new")}>
            Add
          </Button>
        }
      />

      <ul className="crud-list">
        {(categories.data ?? []).map((c) => (
          <li key={c.id}>
            <button className="crow" onClick={() => setForm(c)}>
              <span className="cats__name">{c.name}</span>
              <Chevron />
            </button>
          </li>
        ))}
      </ul>

      <CategoryForm target={form} onClose={() => setForm(null)} />
    </div>
  );
}

function CategoryForm({ target, onClose }: { target: Category | "new" | null; onClose: () => void }) {
  const editing = target && target !== "new" ? target : null;
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();

  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setErr(null);
    setName(editing?.name ?? "");
  }, [target, editing]);

  const valid = name.trim().length > 0;
  const busy = create.isPending || update.isPending || remove.isPending;

  async function save() {
    if (!valid) return;
    try {
      setErr(null);
      if (editing) await update.mutateAsync({ id: editing.id, patch: { name: name.trim() } });
      else await create.mutateAsync({ id: crypto.randomUUID(), name: name.trim() });
      onClose();
    } catch (e) {
      setErr(
        e instanceof ApiError && e.code === "CONFLICT"
          ? "A category with that name already exists."
          : "Couldn't save.",
      );
    }
  }

  async function del() {
    if (!editing) return;
    try {
      setErr(null);
      await remove.mutateAsync(editing.id);
      onClose();
    } catch (e) {
      setErr(
        e instanceof ApiError && e.code === "CONFLICT"
          ? "This category is used by transactions, so it can't be deleted."
          : "Couldn't delete.",
      );
    }
  }

  return (
    <Sheet open={!!target} onClose={onClose} title={editing ? "Edit category" : "New category"}>
      <div className="aform">
        <label className="aform__field">
          <span className="fld__label">Name</span>
          <input
            className="aform__input"
            value={name}
            maxLength={80}
            placeholder="e.g. Groceries"
            onChange={(e) => setName(e.target.value)}
            autoFocus={!editing}
          />
        </label>

        {err && (
          <p className="aform__error" role="alert">
            {err}
          </p>
        )}

        <Button block disabled={!valid || busy} onClick={save}>
          {busy ? "Saving…" : editing ? "Save changes" : "Add category"}
        </Button>

        {editing && (
          <button className="aform__del" onClick={del} disabled={busy}>
            Delete category
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
