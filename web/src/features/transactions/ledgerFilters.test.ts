import { describe, expect, it } from "vitest";
import { parseLedgerFilters, toggleLedgerListFilter } from "./ledgerFilters";

describe("parseLedgerFilters", () => {
  it("accepts supported values and rejects malformed URL input", () => {
    const validId = "7dd10595-4a57-4c1c-ab05-31bdc758eea4";
    const params = new URLSearchParams({ month: "2026-09", type: "expense" });
    params.append("accountId", validId);
    params.append("accountId", validId);
    params.append("categoryId", "ef432f8a-58e1-4386-8166-74a0dfd366a1");
    params.append("categoryId", "not-an-id");
    const parsed = parseLedgerFilters(params);

    expect(parsed).toEqual({
      month: "2026-09",
      type: "expense",
      accountIds: [validId],
      categoryIds: ["ef432f8a-58e1-4386-8166-74a0dfd366a1"],
    });
  });

  it("toggles repeated list filters without mutating other URL state", () => {
    const first = "7dd10595-4a57-4c1c-ab05-31bdc758eea4";
    const second = "ef432f8a-58e1-4386-8166-74a0dfd366a1";
    const original = new URLSearchParams(`month=2026-09&type=expense&accountId=${first}`);

    const added = toggleLedgerListFilter(original, "accountId", second);
    const removed = toggleLedgerListFilter(added, "accountId", first);

    expect(original.getAll("accountId")).toEqual([first]);
    expect(added.getAll("accountId")).toEqual([first, second]);
    expect(removed.getAll("accountId")).toEqual([second]);
    expect(removed.get("month")).toBe("2026-09");
    expect(removed.get("type")).toBe("expense");
  });
});
