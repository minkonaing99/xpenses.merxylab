import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { MonthProvider, useMonth } from "./MonthContext";
import { currentMonth } from "../lib/format";

const wrapper = ({ children }: { children: ReactNode }) => <MonthProvider>{children}</MonthProvider>;

describe("MonthContext", () => {
  it("starts on the current month", () => {
    const { result } = renderHook(() => useMonth(), { wrapper });
    expect(result.current.month).toBe(currentMonth());
    expect(result.current.isCurrent).toBe(true);
  });

  it("steps backward and forward across a year boundary", () => {
    const { result } = renderHook(() => useMonth(), { wrapper });
    act(() => result.current.setMonth("2026-01"));
    act(() => result.current.step(-1));
    expect(result.current.month).toBe("2025-12");
    act(() => result.current.step(1));
    expect(result.current.month).toBe("2026-01");
    expect(result.current.isCurrent).toBe(false);
  });
});
