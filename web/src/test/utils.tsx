import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement, ReactNode } from "react";
import { MonthProvider } from "../app/MonthContext";
import { registerMutationDefaults } from "../app/queryClient";

/** Render a screen with the providers it expects: query cache, router, month. */
export function renderApp(ui: ReactElement, route = "/"): RenderResult {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  registerMutationDefaults(qc);
  const Wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <MonthProvider>{children}</MonthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(ui, { wrapper: Wrap });
}

/** Build a fake `api.get` that matches by path prefix. */
export function fakeGet(routes: Record<string, unknown>) {
  return (path: string) => {
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) return Promise.reject(new Error(`no mock for ${path}`));
    return Promise.resolve(routes[key]);
  };
}
