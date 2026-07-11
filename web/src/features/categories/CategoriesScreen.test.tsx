import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() } };
});

import { api, ApiError } from "../../lib/api";
import { CategoriesScreen } from "./CategoriesScreen";
import { fakeGet, renderApp } from "../../test/utils";

const categories = [
  { id: "c1", name: "Food" },
  { id: "c2", name: "Rent" },
];

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(fakeGet({ "/categories": categories }) as never);
  vi.mocked(api.post).mockResolvedValue({} as never);
  vi.mocked(api.patch).mockResolvedValue({} as never);
  vi.mocked(api.del).mockResolvedValue({} as never);
});
afterEach(() => vi.clearAllMocks());

describe("CategoriesScreen", () => {
  it("creates a category", async () => {
    renderApp(<CategoriesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Groceries"), {
      target: { value: "Coffee" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/categories", expect.objectContaining({ name: "Coffee" })),
    );
  });

  it("blocks delete of a referenced category with a message", async () => {
    vi.mocked(api.del).mockRejectedValue(new ApiError("CONFLICT", "no", 409));
    renderApp(<CategoriesScreen />);
    fireEvent.click(await screen.findByRole("button", { name: /Food/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete category" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("used by transactions");
  });
});
