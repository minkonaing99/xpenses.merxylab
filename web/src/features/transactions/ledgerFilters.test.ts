import { describe, expect, it } from "vitest";
import { parseLedgerFilters } from "./ledgerFilters";

describe("parseLedgerFilters", () => {
  it("accepts supported values and rejects malformed URL input", () => {
    const validId = "7dd10595-4a57-4c1c-ab05-31bdc758eea4";
    const parsed = parseLedgerFilters(
      new URLSearchParams({
        month: "2026-09",
        type: "expense",
        accountId: validId,
        categoryId: "not-an-id",
      }),
    );

    expect(parsed).toEqual({
      month: "2026-09",
      type: "expense",
      accountId: validId,
      categoryId: null,
    });
  });
});
