import { describe, expect, it } from "vitest";
import { categoryColor } from "./categoryColor";

describe("categoryColor", () => {
  it("is stable by category ID", () => {
    expect(categoryColor("food")).toBe(categoryColor("food"));
    expect(categoryColor("food")).toMatch(/^var\(--cat-[a-h]\)$/);
  });
});
