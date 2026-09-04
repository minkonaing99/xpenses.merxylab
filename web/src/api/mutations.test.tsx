import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/api", async (orig) => {
  const actual = await orig<typeof import("../lib/api")>();
  return { ...actual, api: { post: vi.fn() } };
});

import { api } from "../lib/api";
import { PERSISTED_QUERY_KEY } from "../app/queryClient";
import { useLogout } from "./mutations";

function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  qc.setQueryData(["me"], { authenticated: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, ...renderHook(() => useLogout(), { wrapper }) };
}

afterEach(() => {
  onlineManager.setOnline(true);
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("useLogout", () => {
  it("clears memory and persisted query caches after server logout", async () => {
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", { removeItem });
    vi.mocked(api.post).mockResolvedValue({} as never);
    const { qc, result } = setup();

    await act(() => result.current.mutateAsync());

    expect(api.post).toHaveBeenCalledWith("/auth/logout", {});
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(removeItem).toHaveBeenCalledWith(PERSISTED_QUERY_KEY);
  });

  it("attempts logout while offline and retains caches when it fails", async () => {
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", { removeItem });
    vi.mocked(api.post).mockRejectedValue(new Error("offline"));
    const { qc, result } = setup();
    onlineManager.setOnline(false);

    act(() => result.current.mutate());

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/auth/logout", {}));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData(["me"])).toEqual({ authenticated: true });
    expect(removeItem).not.toHaveBeenCalled();
  });
});
