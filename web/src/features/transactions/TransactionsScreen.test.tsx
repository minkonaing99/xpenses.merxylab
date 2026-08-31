import { fireEvent, screen } from "@testing-library/react";
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

const accounts = [{ id: "a1", name: "Cash", type: "cash", startingBalance: 0, balance: 0 }];
const categories = [{ id: "c1", name: "Food" }];
const txns = [
  {
    id: "t1",
    type: "expense",
    amount: 12000,
    note: "Latte",
    categoryId: "c1",
    accountId: "a1",
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
afterEach(() => vi.clearAllMocks());

describe("TransactionsScreen", () => {
  it("shows a signed expense row and opens the edit sheet on tap", async () => {
    renderApp(<TransactionsScreen />);
    expect(await screen.findByText("Latte")).toBeInTheDocument();
    // Appears twice: the row amount and the day-net header.
    expect(screen.getAllByText(money("-฿120.00")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Edit Latte/ }));
    expect(await screen.findByRole("dialog", { name: "Edit transaction" })).toBeInTheDocument();
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
