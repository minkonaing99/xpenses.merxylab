import { describe, expect, it, vi } from "vitest";
import { applyTheme, readTheme, saveTheme } from "./theme";

describe("theme preferences", () => {
  it("loads only supported stored themes", () => {
    expect(readTheme({ getItem: () => "dark" })).toBe("dark");
    expect(readTheme({ getItem: () => "light" })).toBe("light");
    expect(readTheme({ getItem: () => "unknown" })).toBe("light");
  });

  it("falls back to light when storage is unavailable", () => {
    expect(readTheme({ getItem: () => { throw new Error("blocked"); } })).toBe("light");
  });

  it("applies and saves a theme without trusting storage", () => {
    const setItem = vi.fn();
    const meta = document.createElement("meta");

    applyTheme("dark", document.documentElement, meta);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(meta.content).toBe("#17151d");

    saveTheme("light", { setItem }, document.documentElement, meta);
    expect(setItem).toHaveBeenCalledWith("xpenses.theme.v1", "light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("still applies when storage rejects writes", () => {
    const root = document.createElement("html");
    expect(() => saveTheme("dark", { setItem: () => { throw new Error("blocked"); } }, root, null)).not.toThrow();
    expect(root.dataset.theme).toBe("dark");
  });
});
