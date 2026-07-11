import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimatedMoney } from "./AnimatedMoney";

// jsdom has no matchMedia, so canAnimate() is false -> the component renders
// its final value immediately (no tween). This is also the reduced-motion path.
describe("AnimatedMoney", () => {
  it("renders the final formatted value without a tween", () => {
    render(<AnimatedMoney amount={20000} />);
    expect(screen.getByText("฿200.00")).toBeInTheDocument();
  });

  it("shows a sign when signed", () => {
    render(<AnimatedMoney amount={-12000} signed />);
    expect(screen.getByText("-฿120.00")).toBeInTheDocument();
  });
});
