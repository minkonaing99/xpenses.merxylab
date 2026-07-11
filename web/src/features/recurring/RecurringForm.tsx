import { useEffect, useMemo, useState } from "react";
import {
  useAccounts,
  useCategories,
  useCreateRecurring,
  useDeleteRecurring,
  useUpdateRecurring,
} from "../../api/hooks";
import type { IntervalUnit, RecurringRule, TxnType } from "../../api/types";
import { ApiError } from "../../lib/api";
import { bahtToSatang } from "../../lib/money";
import { today } from "../../lib/format";
import { Button } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { MoneyInput } from "../../ui/MoneyInput";
import { Sheet } from "../../ui/Sheet";
import { Select } from "../../ui/Select";
import { Chips } from "../transactions/Chips";
import "../transactions/AddTransactionSheet.css";
import "../../ui/form.css";

const TYPES: { value: TxnType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];
const UNITS: { value: IntervalUnit; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

interface Props {
  target: RecurringRule | "new" | null;
  onClose: () => void;
}

export function RecurringForm({ target, onClose }: Props) {
  const editing = target && target !== "new" ? target : null;
  const accounts = useAccounts();
  const categories = useCategories();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const remove = useDeleteRecurring();

  const [type, setType] = useState<TxnType>("expense");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [unit, setUnit] = useState<IntervalUnit>("month");
  const [count, setCount] = useState("1");
  const [nextRun, setNextRun] = useState(today());
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const acctOpts = (accounts.data ?? []).map((a) => ({ value: a.id, label: a.name }));
  const catOpts = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  useEffect(() => {
    if (!target) return;
    setErr(null);
    if (editing) {
      setType(editing.type);
      setAmount((editing.amount / 100).toString());
      setNote(editing.note ?? "");
      setUnit(editing.intervalUnit);
      setCount(String(editing.intervalCount));
      setNextRun(editing.nextRunDate);
      setCategoryId(editing.categoryId ?? null);
      setAccountId(editing.accountId ?? null);
      setFromId(editing.fromAccountId ?? null);
      setToId(editing.toAccountId ?? null);
      return;
    }
    setType("expense");
    setAmount("");
    setNote("");
    setUnit("month");
    setCount("1");
    setNextRun(today());
    setCategoryId(null);
    setAccountId(null);
    setFromId(null);
    setToId(null);
  }, [target, editing]);

  // Fill account defaults for a new rule once they load, without overwriting a choice.
  useEffect(() => {
    if (!target || editing) return;
    setAccountId((v) => v ?? accounts.data?.[0]?.id ?? null);
    setFromId((v) => v ?? accounts.data?.[0]?.id ?? null);
    setToId((v) => v ?? accounts.data?.[1]?.id ?? null);
  }, [target, editing, accounts.data]);

  const satang = bahtToSatang(amount);
  const n = Number(count);
  const valid = useMemo(() => {
    if (!satang || satang <= 0) return false;
    if (!Number.isInteger(n) || n < 1) return false;
    if (!nextRun) return false;
    if (type === "expense") return !!categoryId && !!accountId;
    if (type === "income") return !!accountId;
    return !!fromId && !!toId && fromId !== toId;
  }, [satang, n, nextRun, type, categoryId, accountId, fromId, toId]);

  const busy = create.isPending || update.isPending || remove.isPending;

  async function save() {
    if (!valid || !satang) return;
    const body = {
      type,
      amount: satang,
      note: note.trim() || null,
      categoryId: type === "expense" ? categoryId : null,
      accountId: type === "transfer" ? null : accountId,
      fromAccountId: type === "transfer" ? fromId : null,
      toAccountId: type === "transfer" ? toId : null,
      intervalUnit: unit,
      intervalCount: n,
      nextRunDate: nextRun,
    };
    try {
      setErr(null);
      if (editing) await update.mutateAsync({ id: editing.id, patch: body });
      else await create.mutateAsync({ id: crypto.randomUUID(), ...body });
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't save.");
    }
  }

  async function del() {
    if (!editing) return;
    try {
      await remove.mutateAsync(editing.id);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't delete.");
    }
  }

  return (
    <Sheet open={!!target} onClose={onClose} title={editing ? "Edit rule" : "New recurring rule"}>
      <div className="add">
        <Segmented options={TYPES} value={type} onChange={setType} label="Transaction type" />

        <label className="add__amount">
          <span className="add__baht" aria-hidden="true">฿</span>
          <MoneyInput
            className="num"
            value={amount}
            onChange={setAmount}
            ariaLabel="Amount in baht"
          />
        </label>

        {type === "expense" && (
          <div className="fld">
            <span className="fld__label">Category</span>
            <Select
              options={catOpts}
              value={categoryId}
              onChange={setCategoryId}
              label="Category"
              placeholder="Select category"
            />
          </div>
        )}

        {type !== "transfer" && (
          <div className="fld">
            <span className="fld__label">{type === "income" ? "To account" : "Paid from"}</span>
            <Chips options={acctOpts} value={accountId} onChange={setAccountId} />
          </div>
        )}

        {type === "transfer" && (
          <>
            <div className="fld">
              <span className="fld__label">From</span>
              <Chips options={acctOpts} value={fromId} onChange={setFromId} />
            </div>
            <div className="fld">
              <span className="fld__label">To</span>
              <Chips options={acctOpts} value={toId} onChange={setToId} disabledValue={fromId} />
            </div>
          </>
        )}

        <div className="fld">
          <span className="fld__label">Repeat every</span>
          <div className="add__row">
            <input
              className="add__input num"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
              aria-label="Interval count"
              style={{ maxWidth: "4rem" }}
            />
            <div style={{ flex: 1 }}>
              <Segmented options={UNITS} value={unit} onChange={setUnit} label="Interval unit" />
            </div>
          </div>
        </div>

        <div className="add__row">
          <div className="fld fld--grow">
            <span className="fld__label">Note</span>
            <input
              className="add__input"
              placeholder="Optional"
              maxLength={255}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="fld">
            <span className="fld__label">Next run</span>
            <input
              className="add__input add__date"
              type="date"
              value={nextRun}
              onChange={(e) => setNextRun(e.target.value)}
            />
          </div>
        </div>

        {err && (
          <p className="add__error" role="alert">
            {err}
          </p>
        )}

        <Button block disabled={!valid || busy} onClick={save}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create rule"}
        </Button>

        {editing && (
          <button className="aform__del" onClick={del} disabled={busy}>
            Delete rule
          </button>
        )}
      </div>
    </Sheet>
  );
}
