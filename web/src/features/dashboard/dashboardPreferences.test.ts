import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD_PREFERENCES, loadDashboardPreferences, moveDashboardGroup } from "./dashboardPreferences";

describe("dashboard preferences", () => {
  it("falls back for malformed external storage", () => {
    expect(loadDashboardPreferences({ getItem: () => "bad" })).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
    expect(loadDashboardPreferences({ getItem: () => JSON.stringify({ order: ["wrong"], visible: {} }) }))
      .toEqual(DEFAULT_DASHBOARD_PREFERENCES);
  });

  it("reorders without mutating the previous value", () => {
    const original = { order: [...DEFAULT_DASHBOARD_PREFERENCES.order], visible: { ...DEFAULT_DASHBOARD_PREFERENCES.visible } };
    const next = moveDashboardGroup(original, "spend", -2);
    expect(original.order).toEqual(["upcoming", "accountsBudgets", "spend"]);
    expect(next.order).toEqual(["spend", "upcoming", "accountsBudgets"]);
  });
});
