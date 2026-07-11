import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

import { api } from "../../lib/api";
import { DashboardScreen } from "./DashboardScreen";
import { fakeGet, renderApp } from "../../test/utils";
import { money } from "../../test/money";

const accounts = [
  { id: "a1", name: "Cash", type: "cash", startingBalance: 0, balance: 12000 },
  { id: "a2", name: "Bank", type: "bank", startingBalance: 0, balance: 8000 },
];
const summary = { accounts, monthIncome: 50000, monthExpense: 30000, monthNet: 20000 };
const budgets = [{ id: "b1", categoryId: "c1", limitAmount: 100000, spent: 30000, over: false }];
const categories = [{ id: "c1", name: "Food" }];
const spend = [{ categoryId: "c1", name: "Food", total: 30000 }];
const forecast = {
  month: "2026-07",
  daysInMonth: 31,
  daysElapsed: 10,
  daysRemaining: 21,
  paidIncome: 50000,
  paidExpense: 30000,
  projectedIncome: 50000,
  projectedExpense: 90000,
  projectedNet: -40000,
  dailyBurnRate: 3000,
};
const anomalies = [
  { type: "budget_burn", categoryId: "c1", name: "Food", spent: 85000, limit: 100000, pct: 0.85 },
];

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(
    fakeGet({
      "/reports/summary": summary,
      "/reports/category-spend": spend,
      "/accounts": accounts,
      "/budgets": budgets,
      "/categories": categories,
      "/insights/forecast": forecast,
      "/insights/anomalies": anomalies,
    }) as never,
  );
});
afterEach(() => vi.clearAllMocks());

describe("DashboardScreen", () => {
  it("shows net worth summed from account balances", async () => {
    renderApp(<DashboardScreen />);
    // 12000 + 8000 = 20000 satang = ฿200.00
    // netWorth (12000+8000) and monthNet both format to ฿200.00 in this fixture.
    expect((await screen.findAllByText(money("฿200.00"))).length).toBeGreaterThan(0);
    expect(screen.getByText("Total balance")).toBeInTheDocument();
  });

  it("masks the balance until tapped", async () => {
    renderApp(<DashboardScreen />);
    const reveal = await screen.findByRole("button", { name: "Show balance" });
    expect(screen.getByText(/∗∗∗/)).toBeInTheDocument();

    fireEvent.click(reveal);
    expect(screen.getByRole("button", { name: "Hide balance" })).toBeInTheDocument();
    // hero now shows the real balance (netWorth = ฿200.00)
    expect(screen.getAllByText(money("฿200.00")).length).toBeGreaterThan(0);
  });

  it("renders budgets and category spend once loaded", async () => {
    renderApp(<DashboardScreen />);
    expect(await screen.findAllByText("Food")).not.toHaveLength(0);
    expect(screen.getByText("Budgets")).toBeInTheDocument();
    expect(screen.getByText("Where it went")).toBeInTheDocument();
  });

  it("shows the month-end forecast card", async () => {
    renderApp(<DashboardScreen />);
    expect(await screen.findByText("Month-end forecast")).toBeInTheDocument();
    expect(screen.getByText(/projected net for July/)).toBeInTheDocument();
  });

  it("shows a dismissible anomaly card and hides it on dismiss", async () => {
    window.localStorage?.clear();
    renderApp(<DashboardScreen />);
    expect(await screen.findByText(/85% through its budget/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/85% through its budget/)).not.toBeInTheDocument();
  });
});
