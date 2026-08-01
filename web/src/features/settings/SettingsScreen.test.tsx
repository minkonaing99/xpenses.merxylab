import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

import { api } from "../../lib/api";
import { SettingsScreen } from "./SettingsScreen";
import { renderApp } from "../../test/utils";

const reload = vi.fn();

beforeEach(() => {
  vi.mocked(api.post).mockResolvedValue({} as never);
  vi.stubGlobal("location", { ...window.location, reload });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("SettingsScreen", () => {
  it("links to each management screen", () => {
    renderApp(<SettingsScreen />);
    for (const label of ["Accounts", "Categories", "Budgets", "Recurring"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("offers a date-range export link defaulting to the current month", () => {
    renderApp(<SettingsScreen />);
    const link = screen.getByRole("link", { name: /Download CSV/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("/api/reports/export?from="));
    expect(link).toHaveAttribute("href", expect.stringContaining("format=csv"));
  });

  it("switches the export to JSON", () => {
    renderApp(<SettingsScreen />);
    fireEvent.change(screen.getByLabelText(/Format/), { target: { value: "json" } });
    const link = screen.getByRole("link", { name: /Download JSON/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("format=json"));
  });

  it("signs out and reloads", async () => {
    renderApp(<SettingsScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/auth/logout", {}));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });
});
