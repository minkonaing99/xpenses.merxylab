// Build one-tap "repeat" templates from recent transactions. Pure.
import type { Transaction } from "../api/types";

export interface TxnTemplate {
  type: "expense" | "income";
  amount: number; // satang
  note: string | null;
  categoryId: string | null;
  accountId: string | null;
}

function signature(t: Transaction): string {
  return [t.type, t.amount, t.categoryId ?? "", t.accountId ?? "", t.note ?? ""].join("|");
}

/**
 * Most-recent distinct expense/income entries as reusable templates.
 * Transfers are skipped (repeating a move between accounts is rarely wanted).
 * Deduped by type+amount+category+account+note, newest first.
 */
export function buildTemplates(txns: Transaction[], limit = 6): TxnTemplate[] {
  const seen = new Set<string>();
  const out: TxnTemplate[] = [];
  const recent = [...txns].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  for (const t of recent) {
    if (t.type === "transfer") continue;
    const sig = signature(t);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({
      type: t.type,
      amount: t.amount,
      note: t.note ?? null,
      categoryId: t.categoryId ?? null,
      accountId: t.accountId ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}
