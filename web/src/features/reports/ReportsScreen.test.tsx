import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

import { api } from "../../lib/api";
import { ReportsScreen } from "./ReportsScreen";
import { fakeGet, renderApp } from "../../test/utils";
import { money } from "../../test/money";

const summary = {
  accounts: [{ id: "a1", name: "Cash", type: "cash", balance: 12000 }],
  monthIncome: 50000,
  monthExpense: 30000,
  monthNet: 20000,
};
const spend = [{ categoryId: "c1", name: "Food", total: 30000 }];
const comparisons = [
  {
    categoryId: "c1",
    name: "Food",
    current: 30000,
    last: 20000,
    prevAvg: 22000,
    vsLast: 10000,
    vsAvg: 8000,
    trend: 1,
  },
];

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(
    fakeGet({
      "/reports/summary": summary,
      "/reports/category-spend": spend,
      "/insights/comparisons": comparisons,
    }) as never,
  );
});
afterEach(() => vi.clearAllMocks());

describe("ReportsScreen", () => {
  it("renders month stats, account balances, and category spend", async () => {
    renderApp(<ReportsScreen />);

    expect(await screen.findByText("Food")).toBeInTheDocument();
    expect(screen.getByText("In")).toBeInTheDocument();
    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(screen.getByText("Net")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText(money("+฿200.00"))).toBeInTheDocument(); // monthNet
  });

  it("shows a month-over-month spend comparison", async () => {
    renderApp(<ReportsScreen />);
    // Both months resolve to the same mocked summary -> flat delta.
    expect(await screen.findByText(/flat vs last month/i)).toBeInTheDocument();
  });

  it("shows a per-category trend chip vs last month", async () => {
    renderApp(<ReportsScreen />);
    // vsLast = 10000 satang = ฿100, spending up -> ▲ 100
    expect(await screen.findByTitle("vs last month")).toHaveTextContent("100");
  });
});
