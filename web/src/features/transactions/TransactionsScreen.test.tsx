import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return {
    ...actual,
    api: { get: vi.fn(), getPage: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
  };
});

import { api } from "../../lib/api";
import { TransactionsScreen } from "./TransactionsScreen";
import { fakeGet, renderApp } from "../../test/utils";
import { money } from "../../test/money";

const accountId = "7dd10595-4a57-4c1c-ab05-31bdc758eea4";
const categoryId = "ef432f8a-58e1-4386-8166-74a0dfd366a1";
const accounts = [{ id: accountId, name: "Cash", type: "cash", startingBalance: 0, balance: 0 }];
const categories = [{ id: categoryId, name: "Food" }];
const txns = [
  {
    id: "t1",
    type: "expense",
    amount: 12000,
    note: "Latte",
    categoryId,
    accountId,
    fromAccountId: null,
    toAccountId: null,
    txnDate: "2026-07-04",
    updatedAt: "2026-07-04T00:00:00.000Z",
  },
];

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(
    fakeGet({ "/accounts": accounts, "/categories": categories }) as never,
  );
  vi.mocked(api.getPage).mockResolvedValue({ data: txns, nextCursor: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function useWideViewport() {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("TransactionsScreen", () => {
  it("shows a signed expense row and opens the edit sheet on tap", async () => {
    renderApp(<TransactionsScreen />);
    expect(await screen.findByText("Latte")).toBeInTheDocument();
    // Appears twice: the row amount and the day-net header.
    expect(screen.getAllByText(money("-฿120.00")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Edit Latte/ }));
    expect(await screen.findByRole("dialog", { name: "Edit transaction" })).toBeInTheDocument();
  });

  it("shows read-only transaction details before editing on wide screens", async () => {
    useWideViewport();
    renderApp(<TransactionsScreen />);

    const details = await screen.findByRole("complementary", { name: "Transaction details" });
    expect(within(details).getByText("Latte")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Edit transaction" })).not.toBeInTheDocument();

    fireEvent.click(within(details).getByRole("button", { name: "Edit transaction" }));
    expect(await screen.findByRole("dialog", { name: "Edit transaction" })).toBeInTheDocument();
  });

  it("uses one segmented type filter on wide screens", async () => {
    useWideViewport();
    renderApp(<TransactionsScreen />);

    const filters = await screen.findByRole("radiogroup", { name: "Filter by type" });
    expect(within(filters).getAllByRole("radio")).toHaveLength(4);
  });

  it("filters rows by the search box (note or category name)", async () => {
    renderApp(<TransactionsScreen />);
    expect(await screen.findByText("Latte")).toBeInTheDocument();

    const box = screen.getByRole("searchbox", { name: /Search transactions/ });
    fireEvent.change(box, { target: { value: "zzz" } });
    expect(screen.queryByText("Latte")).not.toBeInTheDocument();
    expect(screen.getByText("No matches")).toBeInTheDocument();

    fireEvent.change(box, { target: { value: "food" } });
    expect(screen.getByText("Latte")).toBeInTheDocument();
  });

  it("loads URL-backed month, type, account, and category filters", async () => {
    renderApp(
      <TransactionsScreen />,
      `/ledger?month=2026-07&type=expense&accountId=${accountId}&categoryId=${categoryId}`,
    );

    await screen.findByText("Latte");
    expect(api.getPage).toHaveBeenCalledWith(expect.stringContaining("month=2026-07"));
    expect(api.getPage).toHaveBeenCalledWith(expect.stringContaining("type=expense"));
    expect(api.getPage).toHaveBeenCalledWith(expect.stringContaining(`accountId=${accountId}`));
    expect(api.getPage).toHaveBeenCalledWith(expect.stringContaining(`categoryId=${categoryId}`));
  });

  it("keeps the Ledger month URL in sync with month navigation", async () => {
    renderApp(<TransactionsScreen />, "/ledger?month=2026-07");
    await screen.findByText("Latte");

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));

    await waitFor(() =>
      expect(api.getPage).toHaveBeenCalledWith(expect.stringContaining("month=2026-08")),
    );
  });

  it("shows active filters and clears them together", async () => {
    renderApp(
      <TransactionsScreen />,
      `/ledger?month=2026-07&type=expense&accountId=${accountId}&categoryId=${categoryId}`,
    );

    expect(await screen.findByRole("button", { name: "Remove account filter Cash" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove category filter Food" })).toBeInTheDocument();
    expect(screen.getByText("1 result")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));

    expect(screen.queryByRole("button", { name: /Remove account filter/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove category filter/ })).not.toBeInTheDocument();
  });

  it("loads older transactions until the cursor is exhausted", async () => {
    const older = { ...txns[0], id: "t2", note: "Dinner", txnDate: "2026-07-03" };
    vi.mocked(api.getPage).mockImplementation(async (path) =>
      path.includes("cursor=")
        ? { data: [older], nextCursor: null }
        : { data: txns, nextCursor: "cursor+/=" },
    );

    renderApp(<TransactionsScreen />);

    expect(await screen.findByText("Latte")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load older transactions" }));

    expect(await screen.findByText("Dinner")).toBeInTheDocument();
    expect(api.getPage).toHaveBeenLastCalledWith(expect.stringContaining("cursor=cursor%2B%2F%3D"));
    expect(screen.queryByRole("button", { name: "Load older transactions" })).not.toBeInTheDocument();
  });

  it("loads all remaining pages while search is active", async () => {
    const older = { ...txns[0], id: "t2", note: "Dinner", txnDate: "2026-07-03" };
    vi.mocked(api.getPage).mockImplementation(async (path) =>
      path.includes("cursor=")
        ? { data: [older], nextCursor: null }
        : { data: txns, nextCursor: "older" },
    );
    renderApp(<TransactionsScreen />);

    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "Dinner" } });

    expect(await screen.findByText("Dinner")).toBeInTheDocument();
    expect(api.getPage).toHaveBeenCalledTimes(2);
  });

  it("stops when the server repeats a cursor", async () => {
    const older = { ...txns[0], id: "t2", note: "Dinner", txnDate: "2026-07-03" };
    vi.mocked(api.getPage).mockImplementation(async (path) =>
      path.includes("cursor=")
        ? { data: [older], nextCursor: "same" }
        : { data: txns, nextCursor: "same" },
    );

    renderApp(<TransactionsScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Load older transactions" }));
    expect(await screen.findByText("Dinner")).toBeInTheDocument();
    expect(api.getPage).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Load older transactions" })).not.toBeInTheDocument();
  });
});
