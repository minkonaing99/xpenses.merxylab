import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Donut } from "./Donut";

describe("Donut", () => {
  it("selects an interactive segment by pointer and keyboard", () => {
    const onSelect = vi.fn();
    render(<Donut segments={[{ value: 1, color: "red", label: "Food", onSelect }]} />);
    const segment = screen.getByRole("button", { name: "Food" });
    fireEvent.click(segment);
    fireEvent.keyDown(segment, { key: "Enter" });
    fireEvent.keyDown(segment, { key: " " });
    expect(onSelect).toHaveBeenCalledTimes(3);
  });
});
