import { describe, expect, it } from "vitest";
import type { TxnTemplate } from "./templates";
import { mergeTemplates, readFavoriteTemplates, toggleFavoriteTemplate, writeFavoriteTemplates } from "./favoriteTemplates";

const make = (amount: number): TxnTemplate => ({ type: "expense", amount, note: null, categoryId: "c", accountId: "a" });

describe("favorite templates", () => {
  it("rejects malformed storage", () => {
    expect(readFavoriteTemplates({ getItem: () => "not json" })).toEqual([]);
    expect(readFavoriteTemplates({ getItem: () => JSON.stringify([{ type: "transfer" }]) })).toEqual([]);
  });

  it("adds immutably, removes, and caps favorites at four", () => {
    const original = [make(1)];
    const added = [2, 3, 4, 5].reduce((items, amount) => toggleFavoriteTemplate(items, make(amount)), original);
    expect(original).toEqual([make(1)]);
    expect(added).toHaveLength(4);
    expect(toggleFavoriteTemplate(added, make(5))).not.toContainEqual(make(5));
  });

  it("puts favorites first and caps combined templates at six", () => {
    const result = mergeTemplates([make(1)], [make(1), make(2), make(3), make(4), make(5), make(6), make(7)]);
    expect(result).toHaveLength(6);
    expect(result[0]).toEqual(make(1));
  });

  it("writes a copied list capped at four", () => {
    let saved = "";
    writeFavoriteTemplates([1, 2, 3, 4, 5].map(make), { setItem: (_, value) => { saved = value; } });
    expect(JSON.parse(saved)).toHaveLength(4);
  });
});
