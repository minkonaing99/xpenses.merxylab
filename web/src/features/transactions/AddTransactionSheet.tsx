import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useRecentTransactions,
  useUpdateTransaction,
} from "../../api/hooks";
import type { Transaction, TxnType } from "../../api/types";
import { ApiError } from "../../lib/api";
import { bahtToSatang, formatSatang } from "../../lib/money";
import { today } from "../../lib/format";
import { buildTemplates, type TxnTemplate } from "../../lib/templates";
import {
  mergeTemplates,
  readFavoriteTemplates,
  templateKey,
  toggleFavoriteTemplate,
  writeFavoriteTemplates,
} from "../../lib/favoriteTemplates";
import { Button } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { MoneyInput } from "../../ui/MoneyInput";
import { Sheet } from "../../ui/Sheet";
import { Select } from "../../ui/Select";
import { Chips } from "./Chips";
import "./AddTransactionSheet.css";

const TYPES: { value: TxnType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  /** when set, the sheet edits this txn instead of creating a new one */
  editing?: Transaction | null;
}

export function AddTransactionSheet({ open, onClose, editing }: Props) {
  const accounts = useAccounts();
  const categories = useCategories();
  const recent = useRecentTransactions();
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();

  const [type, setType] = useState<TxnType>("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [favorites, setFavorites] = useState<TxnTemplate[]>(readFavoriteTemplates);

  const acctOpts = (accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }));
  const catOpts = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  const templates = useMemo(
    () => mergeTemplates(favorites, buildTemplates(recent.data ?? [])),
    [favorites, recent.data],
  );
  const catNames = useMemo(() => {
    const m = new Map<string, string>();
    (categories.data ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories.data]);

  function applyTemplate(t: TxnTemplate) {
    setErr(null);
    setDirty(true);
    setType(t.type);
    setAmount((t.amount / 100).toString());
    setNote(t.note ?? "");
    setCategoryId(t.categoryId);
    setAccountId(t.accountId);
  }

  function toggleFavorite(template: TxnTemplate) {
    const next = toggleFavoriteTemplate(favorites, template);
    setFavorites(next);
    writeFavoriteTemplates(next);
  }

  // Prefill on open: from the edited txn, else fresh defaults.
  // Deps are only open/editing so late-arriving account data never clobbers edits.
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setConfirmDel(false);
    setDirty(false);
    if (editing) {
      setType(editing.type);
      setAmount((editing.amount / 100).toString());
      setNote(editing.note ?? "");
      setDate(editing.txnDate);
      setCategoryId(editing.categoryId ?? null);
      setAccountId(editing.accountId ?? null);
      setFromId(editing.fromAccountId ?? null);
      setToId(editing.toAccountId ?? null);
      return;
    }
    setType("expense");
    setAmount("");
    setNote("");
    setDate(today());
    setCategoryId(null);
    setAccountId(null);
    setFromId(null);
    setToId(null);
  }, [open, editing]);

  // Fill account defaults for a new txn once they load, without overwriting a choice.
  useEffect(() => {
    if (!open || editing) return;
    setAccountId((v) => v ?? accounts.data?.[0]?.id ?? null);
    setFromId((v) => v ?? accounts.data?.[0]?.id ?? null);
    setToId((v) => v ?? accounts.data?.[1]?.id ?? null);
  }, [open, editing, accounts.data]);

  const satang = bahtToSatang(amount);
  const valid = useMemo(() => {
    if (!satang || satang <= 0) return false;
    if (type === "expense") return !!categoryId && !!accountId;
    if (type === "income") return !!accountId;
    return !!fromId && !!toId && fromId !== toId;
  }, [satang, type, categoryId, accountId, fromId, toId]);

  const busy = create.isPending || update.isPending || remove.isPending;

  async function submit() {
    if (!valid || !satang) return;
    const fields = {
      type,
      amount: satang,
      note: note.trim() || null,
      categoryId: type === "expense" ? categoryId : null,
      accountId: type === "transfer" ? null : accountId,
      fromAccountId: type === "transfer" ? fromId : null,
      toAccountId: type === "transfer" ? toId : null,
      txnDate: date,
      updatedAt: new Date().toISOString(),
    };
    try {
      setErr(null);
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: fields });
      } else {
        await create.mutateAsync({ id: crypto.randomUUID(), ...fields } as Transaction);
      }
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
    }
  }

  async function del() {
    if (!editing) return;
    try {
      setErr(null);
      await remove.mutateAsync({ id: editing.id, updatedAt: new Date().toISOString() });
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't delete. Try again.");
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "Edit transaction" : "New transaction"}
      dirty={dirty}
    >
      <div className="add">
        <Segmented
          options={TYPES}
          value={type}
          onChange={(value) => {
            setType(value);
            setDirty(true);
          }}
          label="Transaction type"
        />

        {!editing && templates.length > 0 && (
          <div className="add__repeat" aria-label="Repeat a recent transaction">
            {templates.map((t) => {
              const favorite = favorites.some((item) => templateKey(item) === templateKey(t));
              const stale = !(accounts.data ?? []).some((account) => account.id === t.accountId)
                || (!!t.categoryId && !(categories.data ?? []).some((category) => category.id === t.categoryId));
              return <div className="add__template" key={templateKey(t)}>
              <button type="button" className="add__chip" disabled={favorite && stale} onClick={() => applyTemplate(t)}>
                <span className="add__chip-label">
                  {t.note?.trim() || catNames.get(t.categoryId ?? "") || (t.type === "income" ? "Income" : "Expense")}
                </span>
                <span className="add__chip-amt num">
                  <span className="num__baht">฿</span>
                  {formatSatang(t.amount)}
                </span>
              </button>
              <button type="button" className="add__favorite" onClick={() => toggleFavorite(t)}
                aria-label={`${favorite ? "Remove" : "Add"} favorite template`}>
                {favorite ? "Saved" : "Save"}
              </button>
              {favorite && stale && <span className="add__stale">Account or category was deleted. Remove this favorite.</span>}
              </div>;
            })}
          </div>
        )}

        <label className="add__amount">
          <span className="add__baht" aria-hidden="true">฿</span>
          <MoneyInput
            className="num"
            value={amount}
            onChange={(value) => {
              setAmount(value);
              setDirty(true);
            }}
            ariaLabel="Amount in baht"
            autoFocus={!editing}
          />
        </label>

        {type === "expense" && (
          <Field label="Category">
            <Select
              options={catOpts}
              value={categoryId}
              onChange={(value) => {
                setCategoryId(value);
                setDirty(true);
              }}
              label="Category"
              placeholder="Select category"
            />
          </Field>
        )}

        {type !== "transfer" && (
          <Field label={type === "income" ? "To account" : "Paid from"}>
            <Chips
              options={acctOpts}
              value={accountId}
              onChange={(value) => {
                setAccountId(value);
                setDirty(true);
              }}
            />
          </Field>
        )}

        {type === "transfer" && (
          <>
            <Field label="From">
              <Chips
                options={acctOpts}
                value={fromId}
                onChange={(value) => {
                  setFromId(value);
                  setDirty(true);
                }}
              />
            </Field>
            <Field label="To">
              <Chips
                options={acctOpts}
                value={toId}
                onChange={(value) => {
                  setToId(value);
                  setDirty(true);
                }}
                disabledValue={fromId}
              />
            </Field>
          </>
        )}

        <div className="add__row">
          <Field label="Note" grow>
            <input
              className="add__input"
              placeholder="Optional"
              maxLength={255}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
              }}
            />
          </Field>
          <Field label="Date">
            <input
              className="add__input add__date"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => {
                setDate(e.target.value);
                setDirty(true);
              }}
            />
          </Field>
        </div>

        {err && (
          <p className="add__error" role="alert">
            {err}
          </p>
        )}

        <Button block disabled={!valid || busy} onClick={submit}>
          {busy ? "Saving…" : editing ? "Save changes" : "Save"}
        </Button>

        {editing &&
          (confirmDel ? (
            <div className="add__confirm">
              <span>Delete this transaction?</span>
              <div className="add__confirm-actions">
                <Button variant="quiet" onClick={() => setConfirmDel(false)}>
                  Cancel
                </Button>
                <button className="add__del" onClick={del} disabled={busy}>
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button className="add__del add__del--full" onClick={() => setConfirmDel(true)}>
              Delete
            </button>
          ))}
      </div>
    </Sheet>
  );
}

function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: ReactNode;
  grow?: boolean;
}) {
  return (
    <div className={`fld${grow ? " fld--grow" : ""}`}>
      <span className="fld__label">{label}</span>
      {children}
    </div>
  );
}
