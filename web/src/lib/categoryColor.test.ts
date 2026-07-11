import { describe, expect, it } from "vitest";
import { categoryColor, categoryColorVar } from "./categoryColor";

describe("categoryColor", () => {
  it("is deterministic for the same id", () => {
    expect(categoryColorVar("abc")).toBe(categoryColorVar("abc"));
  });

  it("returns a var() css value", () => {
    expect(categoryColor("abc")).toMatch(/^var\(--cat-[a-h]\)$/);
  });

  it("falls back to the first color for empty ids", () => {
    expect(categoryColorVar(null)).toBe("--cat-a");
    expect(categoryColorVar(undefined)).toBe("--cat-a");
  });

  it("spreads different ids across the palette", () => {
    const seen = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(categoryColorVar),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});
