import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Money } from "./Money";
import { money } from "../test/money";

describe("Money", () => {
  it("renders unsigned THB", () => {
    render(<Money amount={129990} />);
    expect(screen.getByText(money("฿1,299.90"))).toBeInTheDocument();
  });

  it("signs and tints a negative amount", () => {
    render(<Money amount={-12000} signed />);
    const el = screen.getByText(money("-฿120.00"));
    expect(el).toHaveStyle({ color: "var(--neg)" });
  });

  it("forces a tone regardless of sign", () => {
    render(<Money amount={500} tone="neg" />);
    expect(screen.getByText(money("฿5.00"))).toHaveStyle({ color: "var(--neg)" });
  });
});
