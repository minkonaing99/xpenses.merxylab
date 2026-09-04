import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

import { api } from "../../lib/api";
import type { Transaction } from "../../api/types";
import { AddTransactionSheet } from "./AddTransactionSheet";
import { fakeGet, renderApp } from "../../test/utils";

const accounts = [
  { id: "a1", name: "Cash", type: "cash", startingBalance: 0, balance: 0 },
  { id: "a2", name: "Bank", type: "bank", startingBalance: 0, balance: 0 },
];
const categories = [{ id: "c1", name: "Food" }];
const recentTxns = [
  {
    id: "t9",
    type: "expense",
    amount: 6000,
    note: "Coffee",
    categoryId: "c1",
    accountId: "a1",
    fromAccountId: null,
    toAccountId: null,
    txnDate: "2026-07-08",
    updatedAt: "2026-07-08T00:00:00.000Z",
  },
];

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(
    fakeGet({ "/accounts": accounts, "/categories": categories, "/transactions": recentTxns }) as never,
  );
  vi.mocked(api.post).mockResolvedValue({} as never);
  vi.mocked(api.patch).mockResolvedValue({} as never);
  vi.mocked(api.del).mockResolvedValue({} as never);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AddTransactionSheet", () => {
  it("keeps Save disabled until an expense is valid", async () => {
    renderApp(<AddTransactionSheet open onClose={() => {}} />);
    await screen.findByRole("option", { name: "Food" });
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Amount in baht"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "c1" } });
    expect(save).toBeEnabled();
  });

  it("creates an expense and closes", async () => {
    const onClose = vi.fn();
    renderApp(<AddTransactionSheet open onClose={onClose} />);
    await screen.findByRole("option", { name: "Food" });

    fireEvent.change(screen.getByLabelText("Amount in baht"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "c1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/transactions",
        expect.objectContaining({
          type: "expense",
          amount: 12000,
          categoryId: "c1",
          accountId: "a1",
        }),
      ),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("hides and never submits a note for transfers", async () => {
    renderApp(<AddTransactionSheet open onClose={() => {}} />);
    await screen.findByRole("option", { name: "Food" });

    fireEvent.change(screen.getByPlaceholderText("Optional"), { target: { value: "Private memo" } });
    fireEvent.click(screen.getByRole("radio", { name: "Transfer" }));
    expect(screen.queryByPlaceholderText("Optional")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Amount in baht"), { target: { value: "120" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/transactions",
        expect.objectContaining({ type: "transfer", note: null }),
      ),
    );
  });

  it("preserves a hidden legacy note when editing a transfer", async () => {
    const editing: Transaction = {
      id: "t2",
      type: "transfer",
      amount: 12000,
      note: "Legacy memo",
      categoryId: null,
      accountId: null,
      fromAccountId: "a1",
      toAccountId: "a2",
      txnDate: "2026-07-10",
      updatedAt: "2026-07-10T00:00:00.000Z",
    };
    renderApp(<AddTransactionSheet open editing={editing} onClose={() => {}} />);

    expect(screen.queryByPlaceholderText("Optional")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        "/transactions/t2",
        expect.objectContaining({ note: "Legacy memo" }),
      ),
    );
  });

  it("prefills the form from a one-tap repeat chip", async () => {
    renderApp(<AddTransactionSheet open onClose={() => {}} />);
    const chip = await screen.findByRole("button", { name: /Coffee/ });
    fireEvent.click(chip);

    expect(screen.getByLabelText("Amount in baht")).toHaveValue("60");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("saves and removes a favorite quick-add template", async () => {
    let saved: string | null = null;
    vi.stubGlobal("localStorage", {
      getItem: () => saved,
      setItem: (_key: string, value: string) => { saved = value; },
    });
    renderApp(<AddTransactionSheet open onClose={() => {}} />);
    const save = await screen.findByRole("button", { name: "Add favorite template" });
    fireEvent.click(save);
    const remove = screen.getByRole("button", { name: "Remove favorite template" });
    expect(saved).toContain("Coffee");
    fireEvent.click(remove);
    expect(saved).toBe("[]");
  });

  it("confirms before closing a changed draft", async () => {
    const onClose = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderApp(<AddTransactionSheet open onClose={onClose} />);
    await screen.findByRole("option", { name: "Food" });

    fireEvent.change(screen.getByLabelText("Amount in baht"), { target: { value: "120" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);

    expect(window.confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("edits then deletes an existing transaction", async () => {
    const editing: Transaction = {
      id: "t1",
      type: "expense",
      amount: 12000,
      note: "Latte",
      categoryId: "c1",
      accountId: "a1",
      fromAccountId: null,
      toAccountId: null,
      txnDate: "2026-07-10",
      updatedAt: "2026-07-10T00:00:00.000Z",
    };
    renderApp(<AddTransactionSheet open editing={editing} onClose={() => {}} />);

    expect(await screen.findByDisplayValue("120")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Amount in baht"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        "/transactions/t1",
        expect.objectContaining({ amount: 20000 }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(api.del).toHaveBeenCalledWith(
        "/transactions/t1",
        expect.objectContaining({ updatedAt: expect.any(String) }),
      ),
    );
  });
});
