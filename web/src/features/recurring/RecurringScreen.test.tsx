import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

import { api } from "../../lib/api";
import { RecurringScreen } from "./RecurringScreen";
import { fakeGet, renderApp } from "../../test/utils";

const accounts = [
  { id: "a1", name: "Cash", type: "cash", startingBalance: 0, balance: 0 },
  { id: "a2", name: "Bank", type: "bank", startingBalance: 0, balance: 0 },
];
const categories = [{ id: "c1", name: "Food" }];
const rules = [
  {
    id: "r1",
    type: "expense",
    amount: 30000,
    note: "Rent",
    categoryId: "c1",
    accountId: "a1",
    intervalUnit: "month",
    intervalCount: 1,
    nextRunDate: "2026-08-01",
    active: true,
  },
];

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(
    fakeGet({ "/recurring": rules, "/accounts": accounts, "/categories": categories }) as never,
  );
  vi.mocked(api.post).mockResolvedValue({} as never);
  vi.mocked(api.patch).mockResolvedValue({} as never);
  vi.mocked(api.del).mockResolvedValue({} as never);
});
afterEach(() => vi.clearAllMocks());

describe("RecurringScreen", () => {
  it("pauses an active rule via the switch", async () => {
    renderApp(<RecurringScreen />);
    fireEvent.click(await screen.findByRole("switch", { name: "Pause rule" }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/recurring/r1", { active: false }),
    );
  });

  it("creates a rule from the form", async () => {
    renderApp(<RecurringScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));

    await screen.findByRole("option", { name: "Food" });
    fireEvent.change(screen.getByLabelText("Amount in baht"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "c1" } });
    fireEvent.click(screen.getByRole("button", { name: "Create rule" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/recurring",
        expect.objectContaining({
          amount: 50000,
          categoryId: "c1",
          accountId: "a1",
          intervalUnit: "month",
          intervalCount: 1,
        }),
      ),
    );
  });
});
