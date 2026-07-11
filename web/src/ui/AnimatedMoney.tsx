import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { formatSatang, formatSigned } from "../lib/money";
import { canAnimate } from "../lib/motion";

interface Props {
  /** satang */
  amount: number;
  signed?: boolean;
  tone?: "pos" | "neg" | "ink";
  className?: string;
  /** seconds; the roll-up feels quick and calm by default */
  duration?: number;
}

function toneColor(amount: number, signed?: boolean, tone?: Props["tone"]): string {
  const resolved = tone ?? (signed ? (amount < 0 ? "neg" : amount > 0 ? "pos" : "ink") : "ink");
  return resolved === "pos" ? "var(--pos)" : resolved === "neg" ? "var(--neg)" : "var(--ink)";
}

/**
 * Money readout that rolls up to its value on mount and whenever it changes.
 * Same output as <Money>, but animated. Skips the tween (renders the final
 * value) when the user prefers reduced motion.
 */
export function AnimatedMoney({ amount, signed, tone, className = "", duration = 0.7 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const fmt = (v: number) => (signed ? formatSigned(Math.round(v)) : `฿${formatSatang(Math.round(v))}`);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!canAnimate() || prev.current === amount) {
      el.textContent = fmt(amount);
      prev.current = amount;
      return;
    }
    const obj = { v: prev.current };
    const tween = gsap.to(obj, {
      v: amount,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = fmt(obj.v);
      },
    });
    prev.current = amount;
    return () => {
      tween.kill();
    };
    // fmt closes over signed; re-run on amount/signed change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, signed]);

  return (
    <span
      ref={ref}
      className={`num ${className}`.trim()}
      style={{ color: toneColor(amount, signed, tone) }}
    >
      {fmt(amount)}
    </span>
  );
}
