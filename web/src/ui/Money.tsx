import { formatSatang } from "../lib/money";

interface Props {
  /** satang */
  amount: number;
  /** show +/- and tint by sign */
  signed?: boolean;
  /** force a semantic tint regardless of numeric sign */
  tone?: "pos" | "neg" | "ink";
  className?: string;
}

/** Tabular money readout. THB, no floats. */
export function Money({ amount, signed, tone, className = "" }: Props) {
  const resolved = tone ?? (signed ? (amount < 0 ? "neg" : amount > 0 ? "pos" : "ink") : "ink");
  const color =
    resolved === "pos" ? "var(--pos)" : resolved === "neg" ? "var(--neg)" : "var(--ink)";
  const sign = signed ? (amount < 0 ? "-" : amount > 0 ? "+" : "") : "";
  return (
    <span className={`num ${className}`.trim()} style={{ color }}>
      {sign}
      <span className="num__baht">฿</span>
      {formatSatang(amount)}
    </span>
  );
}
