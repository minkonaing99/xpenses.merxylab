import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Segmented } from "./Segmented";

const opts = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

describe("Segmented", () => {
  it("marks the active option", () => {
    render(<Segmented options={opts} value="a" onChange={() => {}} label="x" />);
    expect(screen.getByRole("radio", { name: "Alpha" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Beta" })).not.toBeChecked();
  });

  it("calls onChange when another option is tapped", () => {
    const onChange = vi.fn();
    render(<Segmented options={opts} value="a" onChange={onChange} label="x" />);
    fireEvent.click(screen.getByRole("radio", { name: "Beta" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
