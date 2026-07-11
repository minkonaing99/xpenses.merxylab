import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "./LoginScreen";
import { api } from "../../lib/api";
import { ApiError } from "../../lib/api";

afterEach(() => vi.restoreAllMocks());

describe("LoginScreen", () => {
  it("submits the password and calls onSuccess", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({});
    const onSuccess = vi.fn();
    render(<LoginScreen onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith("/auth/login", { password: "hunter2" });
  });

  it("shows an error on a bad password", async () => {
    vi.spyOn(api, "post").mockRejectedValue(new ApiError("UNAUTHORIZED", "no", 401));
    render(<LoginScreen onSuccess={() => {}} />);

    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("didn't work");
  });
});
