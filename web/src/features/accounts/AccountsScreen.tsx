import { useEffect, useState } from "react";
import {
  useAccounts,
  useBalanceCheck,
  useCreateAccount,
  useDeleteAccount,
  useUpdateAccount,
  useMarkBalanceChecked,
} from "../../api/hooks";
import { useUnresolvedWriteCount } from "../../app/pendingWrites";
import type { Account, AccountType } from "../../api/types";
import { ApiError } from "../../lib/api";
import { bahtToSatang, formatSigned } from "../../lib/money";
import { Button } from "../../ui/Button";
import { Money } from "../../ui/Money";
import { MoneyInput } from "../../ui/MoneyInput";
import { PageHeader } from "../../ui/PageHeader";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import "../../ui/form.css";
import "./AccountsScreen.css";

const TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
];

export function AccountsScreen() {
  const accounts = useAccounts();
  const [form, setForm] = useState<Account | "new" | null>(null);
  const [checking, setChecking] = useState<Account | null>(null);

  return (
    <div className="accts">
      <PageHeader
        title="Accounts"
        back="/settings"
        action={
          <Button variant="ghost" className="accts__add" onClick={() => setForm("new")}>
            Add
          </Button>
        }
      />

      <ul className="accts__list">
        {(accounts.data ?? []).map((a) => (
          <li key={a.id}>
            <button className="arow" onClick={() => setForm(a)}>
              <div className="arow__text">
                <span className="arow__name">{a.name}</span>
                <span className="arow__type">{a.type}{(a.reserved ?? 0) > 0 && <> · Available <Money amount={a.available ?? a.balance} /></>}</span>
              </div>
              <Money amount={a.balance} className="arow__bal" />
            </button>
          </li>
        ))}
      </ul>

      <AccountForm
        target={form}
        onClose={() => setForm(null)}
        canDelete={(accounts.data ?? []).length > 1}
        onCheck={(account) => { setForm(null); setChecking(account); }}
      />
      <BalanceCheckSheet account={checking} onClose={() => setChecking(null)} />
    </div>
  );
}

function AccountForm({
  target,
  onClose,
  canDelete,
  onCheck,
}: {
  target: Account | "new" | null;
  onClose: () => void;
  canDelete: boolean;
  onCheck: (account: Account) => void;
}) {
  const editing = target && target !== "new" ? target : null;
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const remove = useDeleteAccount();

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("cash");
  const [start, setStart] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!target) return;
    setErr(null);
    setDirty(false);
    setName(editing?.name ?? "");
    setType(editing?.type ?? "cash");
    setStart(editing ? (editing.startingBalance / 100).toString() : "");
  }, [target, editing]);

  const startSatang = start.trim() === "" ? 0 : bahtToSatang(start);
  const valid = name.trim().length > 0 && startSatang !== null;
  const busy = create.isPending || update.isPending || remove.isPending;

  async function save() {
    if (!valid || startSatang === null) return;
    try {
      setErr(null);
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          patch: { name: name.trim(), type, startingBalance: startSatang },
        });
      } else {
        await create.mutateAsync({
          id: crypto.randomUUID(),
          name: name.trim(),
          type,
          startingBalance: startSatang,
        });
      }
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't save.");
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
          ? "This account has transactions, so it can't be deleted."
          : "Couldn't delete.",
      );
    }
  }

  return (
    <Sheet open={!!target} onClose={onClose} title={editing ? "Edit account" : "New account"} dirty={dirty}>
      <div className="aform">
        <label className="aform__field">
          <span className="fld__label">Name</span>
          <input
            className="aform__input"
            value={name}
            maxLength={80}
            placeholder="e.g. Cash"
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            autoFocus={!editing}
          />
        </label>

        <div className="aform__field">
          <span className="fld__label">Type</span>
          <Segmented options={TYPES} value={type} onChange={(value) => { setType(value); setDirty(true); }} label="Account type" />
        </div>

        <label className="aform__field">
          <span className="fld__label">Starting balance (฿)</span>
          <MoneyInput
            className="aform__input num"
            value={start}
            onChange={(value) => { setStart(value); setDirty(true); }}
            ariaLabel="Starting balance in baht"
          />
        </label>

        {err && (
          <p className="aform__error" role="alert">
            {err}
          </p>
        )}

        <Button block disabled={!valid || busy} onClick={save}>
          {busy ? "Saving…" : editing ? "Save changes" : "Add account"}
        </Button>

        {editing && <Button block variant="quiet" onClick={() => onCheck(editing)}>Check balance</Button>}

        {editing && canDelete && (
          <button className="aform__del" onClick={del} disabled={busy}>
            Delete account
          </button>
        )}
      </div>
    </Sheet>
  );
}

function BalanceCheckSheet({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const check = useBalanceCheck(account?.id ?? null);
  const mark = useMarkBalanceChecked();
  const unresolved = useUnresolvedWriteCount();
  const [actual, setActual] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const parsed = bahtToSatang(actual);
  const tracked = check.data?.account.balance;
  const difference = parsed !== null && tracked !== undefined ? parsed - tracked : null;
  const blocked = !navigator.onLine || unresolved > 0;

  useEffect(() => {
    if (account) { setActual(""); setErr(null); void check.refetch(); }
    // Account opening is only reset trigger; query object changes each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id]);

  async function save() {
    if (!account || parsed === null || difference !== 0 || !check.data || blocked) return;
    try {
      setErr(null);
      await mark.mutateAsync({
        accountId: account.id,
        id: crypto.randomUUID(),
        actualBalance: parsed,
        expectedRevision: check.data.account.balanceRevision,
      });
      await check.refetch();
      onClose();
    } catch (error) {
      setErr(error instanceof ApiError && error.code === "CONFLICT"
        ? "Balance changed. Review fresh totals and try again."
        : "Couldn't save balance check.");
      await check.refetch();
    }
  }

  return <Sheet open={Boolean(account)} onClose={onClose} title={`Check ${account?.name ?? "balance"}`}>
    <div className="bcheck">
      {check.isLoading || !check.data ? <p>Loading current balance...</p> : <>
        <div className="bcheck__row"><span>Tracked balance</span><Money amount={tracked ?? 0} /></div>
        <label className="aform__field">
          <span className="fld__label">Actual balance (฿)</span>
          <MoneyInput value={actual} onChange={setActual} ariaLabel="Actual balance in baht" allowNegative autoFocus />
        </label>
        {difference !== null && <p className={`bcheck__difference${difference === 0 ? " is-match" : ""}`}>
          {difference === 0 ? "Balances match." : difference > 0
            ? `Actual account has ${formatSigned(difference)} more than tracker.`
            : `Tracker has ${formatSigned(-difference)} more than actual account.`}
        </p>}
        {check.data.latestCheck && <p className="bcheck__last">
          Last checked {new Date(check.data.latestCheck.checkedAt).toLocaleDateString()}
          {check.data.latestCheck.needsReview && " - needs review after account changes"}
        </p>}
        {check.data.recentTransactions.length > 0 && <div>
          <span className="fld__label">Recent account activity</span>
          <ul className="bcheck__transactions">
            {check.data.recentTransactions.map((transaction) => <li key={transaction.id}>
              <span>{transaction.note || transaction.txnDate}</span>
              <span>{formatSigned(transaction.type === "income" || transaction.toAccountId === account?.id
                ? transaction.amount : -transaction.amount)}</span>
            </li>)}
          </ul>
        </div>}
        {blocked && <p className="aform__error" role="alert">
          {!navigator.onLine ? "Connect to refresh before marking checked." : "Resolve pending changes first."}
        </p>}
        {err && <p className="aform__error" role="alert">{err}</p>}
        <Button block disabled={difference !== 0 || blocked || mark.isPending} onClick={save}>Mark checked</Button>
        <a className="bcheck__ledger" href={`/ledger?accountId=${account?.id}`}>Review all account transactions</a>
      </>}
    </div>
  </Sheet>;
}
