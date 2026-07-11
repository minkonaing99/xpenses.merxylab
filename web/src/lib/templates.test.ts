import { describe, expect, it } from "vitest";
import { buildTemplates } from "./templates";
import type { Transaction } from "../api/types";

function txn(p: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    type: "expense",
    amount: 100,
    note: null,
    categoryId: "c1",
    accountId: "a1",
    fromAccountId: null,
    toAccountId: null,
    txnDate: "2026-07-01",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...p,
  };
}

describe("buildTemplates", () => {
  it("dedupes identical entries, keeping the newest", () => {
    const t = buildTemplates([
      txn({ note: "Coffee", amount: 6000, updatedAt: "2026-07-01T00:00:00.000Z" }),
      txn({ note: "Coffee", amount: 6000, updatedAt: "2026-07-05T00:00:00.000Z" }),
    ]);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ note: "Coffee", amount: 6000 });
  });

  it("orders newest first", () => {
    const t = buildTemplates([
      txn({ note: "Old", updatedAt: "2026-07-01T00:00:00.000Z" }),
      txn({ note: "New", updatedAt: "2026-07-09T00:00:00.000Z" }),
    ]);
    expect(t.map((x) => x.note)).toEqual(["New", "Old"]);
  });

  it("skips transfers", () => {
    const t = buildTemplates([
      txn({ type: "transfer", categoryId: null, accountId: null, fromAccountId: "a1", toAccountId: "a2" }),
    ]);
    expect(t).toHaveLength(0);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => txn({ note: `n${i}`, amount: i + 1 }));
    expect(buildTemplates(many, 3)).toHaveLength(3);
  });
});
