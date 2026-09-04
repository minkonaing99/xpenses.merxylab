import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

afterEach(() => vi.restoreAllMocks());

describe("Sheet", () => {
  it("closes unchanged content from the scrim", () => {
    const onClose = vi.fn();
    render(<Sheet open title="Example" onClose={onClose}>Content</Sheet>);

    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps dirty content open when discard is rejected", () => {
    const onClose = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Sheet open dirty title="Example" onClose={onClose}>Content</Sheet>);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(window.confirm).toHaveBeenCalledWith("Discard unsaved changes?");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes dirty content after discard is confirmed", () => {
    const onClose = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Sheet open dirty title="Example" onClose={onClose}>Content</Sheet>);

    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);

    expect(onClose).toHaveBeenCalledOnce();
  });
});
