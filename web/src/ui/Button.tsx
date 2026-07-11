import type { ButtonHTMLAttributes } from "react";
import "./Button.css";

type Variant = "primary" | "ghost" | "quiet";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export function Button({ variant = "primary", block, className = "", ...rest }: Props) {
  return (
    <button
      className={`btn btn--${variant}${block ? " btn--block" : ""} ${className}`.trim()}
      {...rest}
    />
  );
}
