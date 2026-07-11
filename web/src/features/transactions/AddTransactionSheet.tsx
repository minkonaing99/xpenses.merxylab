import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from "../../api/hooks";
import type { Transaction, TxnType } from "../../api/types";
import { ApiError } from "../../lib/api";
import { bahtToSatang } from "../../lib/money";
import { today } from "../../lib/format";
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

  const acctOpts = (accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }));
  const catOpts = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  // Prefill on open: from the edited txn, else fresh defaults.
  // Deps are only open/editing so late-arriving account data never clobbers edits.
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setConfirmDel(false);
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
    <Sheet open={open} onClose={onClose} title={editing ? "Edit transaction" : "New transaction"}>
      <div className="add">
        <Segmented options={TYPES} value={type} onChange={setType} label="Transaction type" />

        <label className="add__amount">
          <span className="add__baht" aria-hidden="true">฿</span>
          <MoneyInput
            className="num"
            value={amount}
            onChange={setAmount}
            ariaLabel="Amount in baht"
            autoFocus={!editing}
          />
        </label>

        {type === "expense" && (
          <Field label="Category">
            <Select
              options={catOpts}
              value={categoryId}
              onChange={setCategoryId}
              label="Category"
              placeholder="Select category"
            />
          </Field>
        )}

        {type !== "transfer" && (
          <Field label={type === "income" ? "To account" : "Paid from"}>
            <Chips options={acctOpts} value={accountId} onChange={setAccountId} />
          </Field>
        )}

        {type === "transfer" && (
          <>
            <Field label="From">
              <Chips options={acctOpts} value={fromId} onChange={setFromId} />
            </Field>
            <Field label="To">
              <Chips options={acctOpts} value={toId} onChange={setToId} disabledValue={fromId} />
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
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Field label="Date">
            <input
              className="add__input add__date"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => setDate(e.target.value)}
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
