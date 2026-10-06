import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("moves focus in on open, wraps Tab inside the panel, and restores focus on close", () => {
    const view = (open: boolean) => (
      <>
        <button>Opener</button>
        <Sheet open={open} title="Example" onClose={() => {}}><button>Inside</button></Sheet>
      </>
    );
    const { rerender } = render(view(false));
    const opener = screen.getByRole("button", { name: "Opener" });
    opener.focus();

    rerender(view(true));
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    const inside = screen.getByRole("button", { name: "Inside" });
    const close = within(dialog).getByRole("button", { name: "Close" });
    inside.focus();
    fireEvent.keyDown(inside, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(inside);

    rerender(view(false));
    expect(document.activeElement).toBe(opener);
  });

  it("skips hidden inputs when wrapping Tab", () => {
    render(<Sheet open title="Example" onClose={() => {}}><button>Inside</button><input type="hidden" /></Sheet>);
    const inside = screen.getByRole("button", { name: "Inside" });
    inside.focus();
    fireEvent.keyDown(inside, { key: "Tab" });
    expect(document.activeElement).toBe(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
  });

  it("gives Escape to the top sheet even after the lower one re-renders", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const view = (label: string) => (
      <>
        <Sheet open title="Outer" onClose={() => outer()}>{label}</Sheet>
        <Sheet open title="Inner" onClose={inner}>b</Sheet>
      </>
    );
    const { rerender } = render(view("a"));
    rerender(view("changed"));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it("keeps focus on an autofocused field", () => {
    render(<Sheet open title="Example" onClose={() => {}}><input aria-label="Amount" autoFocus /></Sheet>);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Amount" }));
  });

  it("closes only the top sheet on Escape", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <>
        <Sheet open title="Outer" onClose={outer}>a</Sheet>
        <Sheet open title="Inner" onClose={inner}>b</Sheet>
      </>,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });
});
