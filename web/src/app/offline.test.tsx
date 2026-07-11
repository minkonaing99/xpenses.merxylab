import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", async (orig) => {
  const actual = await orig<typeof import("../lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

import { api } from "../lib/api";
import { registerMutationDefaults } from "./queryClient";
import { useCreateTransaction } from "../api/hooks";
import type { Transaction } from "../api/types";

const txn: Transaction = {
  id: "t1",
  type: "expense",
  amount: 12000,
  note: "offline latte",
  categoryId: "c1",
  accountId: "a1",
  fromAccountId: null,
  toAccountId: null,
  txnDate: "2026-07-11",
  updatedAt: "2026-07-11T00:00:00.000Z",
};

afterEach(() => {
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("offline write queue", () => {
  it("pauses a write while offline, then replays it on reconnect", async () => {
    vi.mocked(api.post).mockResolvedValue({} as never);
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
    registerMutationDefaults(qc);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    onlineManager.setOnline(false);
    const { result } = renderHook(() => useCreateTransaction(), { wrapper });
    result.current.mutate(txn);

    // Offline: the request must not go out.
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    expect(api.post).not.toHaveBeenCalled();

    // Reconnect: the queued write replays automatically.
    onlineManager.setOnline(true);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/transactions", txn));
  });
});
