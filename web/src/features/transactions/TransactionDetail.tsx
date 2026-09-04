import type { Transaction } from "../../api/types";
import { Money } from "../../ui/Money";
import { Button } from "../../ui/Button";

type Names = { acct: Map<string, string>; cat: Map<string, string> };

export function TransactionDetail({
  transaction,
  names,
  onEdit,
}: {
  transaction: Transaction;
  names: Names;
  onEdit: () => void;
}) {
  const account = transaction.type === "transfer"
    ? `${names.acct.get(transaction.fromAccountId ?? "") ?? "Unknown"} to ${names.acct.get(transaction.toAccountId ?? "") ?? "Unknown"}`
    : names.acct.get(transaction.accountId ?? "") ?? "Unknown";
  const title = transaction.note?.trim()
    || names.cat.get(transaction.categoryId ?? "")
    || (transaction.type === "transfer" ? "Transfer" : transaction.type);
  const amount = transaction.type === "expense" ? -transaction.amount : transaction.amount;

  return (
    <aside className="ledger-detail" aria-label="Transaction details">
      <p className="ledger-detail__eyebrow">Transaction details</p>
      <h2>{title}</h2>
      <Money amount={amount} signed={transaction.type !== "transfer"} className="ledger-detail__amount" />
      <dl>
        <div><dt>Date</dt><dd>{transaction.txnDate}</dd></div>
        <div><dt>Type</dt><dd>{transaction.type}</dd></div>
        <div><dt>Account</dt><dd>{account}</dd></div>
        {transaction.categoryId && <div><dt>Category</dt><dd>{names.cat.get(transaction.categoryId) ?? "Unknown"}</dd></div>}
        {transaction.note && transaction.note !== title && <div><dt>Note</dt><dd>{transaction.note}</dd></div>}
      </dl>
      <Button onClick={onEdit}>Edit transaction</Button>
    </aside>
  );
}
