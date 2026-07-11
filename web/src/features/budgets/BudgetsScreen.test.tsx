import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

import { api } from "../../lib/api";
import { BudgetsScreen } from "./BudgetsScreen";
import { fakeGet, renderApp } from "../../test/utils";

const categories = [
  { id: "c1", name: "Food" },
  { id: "c2", name: "Rent" },
];
const budgets = [{ id: "b1", categoryId: "c1", limitAmount: 500000, spent: 100000, over: false }];

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(
    fakeGet({ "/categories": categories, "/budgets": budgets }) as never,
  );
  vi.mocked(api.post).mockResolvedValue({} as never);
  vi.mocked(api.patch).mockResolvedValue({} as never);
  vi.mocked(api.del).mockResolvedValue({} as never);
});
afterEach(() => vi.clearAllMocks());

describe("BudgetsScreen", () => {
  it("sets a limit on a category that has none", async () => {
    renderApp(<BudgetsScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Rent/ }));
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "8000" } });
    fireEvent.click(screen.getByRole("button", { name: "Set limit" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/budgets",
        expect.objectContaining({ categoryId: "c2", limitAmount: 800000 }),
      ),
    );
  });

  it("edits an existing limit, prefilled from the budget", async () => {
    renderApp(<BudgetsScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Food/ }));
    expect(screen.getByDisplayValue("5000")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("5000"), { target: { value: "6000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save limit" }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/budgets/b1", { limitAmount: 600000 }),
    );
  });
});
