import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";

vi.mock("../lib/api", async (orig) => {
  const actual = await orig<typeof import("../lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

import { api } from "../lib/api";
import { Shell } from "./Shell";
import { MonthSwitcher } from "../ui/MonthSwitcher";
import { fakeGet, renderApp } from "../test/utils";

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(fakeGet({ "/accounts": [], "/categories": [], "/transactions": [] }) as never);
});
afterEach(() => vi.clearAllMocks());

const press = (key: string, target: Element | Window = window) => fireEvent.keyDown(target, { key });

describe("Shell keyboard shortcuts", () => {
  it("n opens the add sheet", () => {
    renderApp(<Shell><p>Page</p></Shell>);
    press("n");
    expect(screen.getByRole("dialog", { name: "New transaction" })).toBeInTheDocument();
  });

  it("? lists the shortcuts", () => {
    renderApp(<Shell><p>Page</p></Shell>);
    press("?");
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("ignores shortcuts while typing or with modifier keys", () => {
    renderApp(<Shell><input aria-label="Note" /></Shell>);
    press("n", screen.getByRole("textbox", { name: "Note" }));
    fireEvent.keyDown(window, { key: "n", metaKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows shortcuts from checkboxes and right after a sheet closes", () => {
    renderApp(<Shell><input type="checkbox" aria-label="Pick" /></Shell>);
    press("?");
    fireEvent.keyDown(window, { key: "Escape" });
    press("n", screen.getByRole("checkbox", { name: "Pick" }));
    expect(screen.getByRole("dialog", { name: "New transaction" })).toBeInTheDocument();
  });

  it("[ and ] press the on-screen month buttons", () => {
    renderApp(<Shell><MonthSwitcher /></Shell>);
    const label = () => document.querySelector(".msw__label")?.textContent;
    const current = label();
    press("[");
    expect(label()).not.toBe(current);
    press("]");
    expect(label()).toBe(current);
  });

  it("/ focuses search, opening the ledger first when needed", () => {
    renderApp(
      <Shell>
        <Routes>
          <Route path="/" element={<p>Home</p>} />
          <Route path="/ledger" element={<input type="search" aria-label="Search transactions" />} />
        </Routes>
      </Shell>,
    );
    press("/");
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search transactions" }));
  });
});
