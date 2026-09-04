import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardCustomizer } from "./DashboardCustomizer";
import { DEFAULT_DASHBOARD_PREFERENCES } from "./dashboardPreferences";

function setup() {
  const onChange = vi.fn();
  const value = {
    order: [...DEFAULT_DASHBOARD_PREFERENCES.order],
    visible: { ...DEFAULT_DASHBOARD_PREFERENCES.visible },
  };
  render(<DashboardCustomizer open value={value} onChange={onChange} onClose={() => {}} />);
  return onChange;
}

describe("DashboardCustomizer", () => {
  it("moves groups with accessible controls", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("button", { name: "Move Where it went up" }));
    expect(onChange.mock.calls[0][0].order).toEqual(["upcoming", "spend", "accountsBudgets"]);
  });

  it("toggles visibility and resets", () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: "Accounts" }));
    expect(onChange.mock.calls[0][0].visible.accounts).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onChange.mock.calls[1][0]).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
  });

  it("supports pointer reordering from the grip", () => {
    const onChange = setup();
    const handle = screen.getByRole("button", { name: "Drag Where it went" });
    const target = screen.getByRole("button", { name: "Drag Upcoming" }).closest(".dash-customize__group");
    Object.defineProperty(handle, "setPointerCapture", { value: vi.fn() });
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => target });
    fireEvent.pointerDown(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(onChange.mock.calls[0][0].order[0]).toBe("spend");
  });
});
