import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { formatSatang } from "../lib/money";
import { canAnimate } from "../lib/motion";

interface Props {
  /** satang */
  amount: number;
  signed?: boolean;
  tone?: "pos" | "neg" | "ink";
  className?: string;
  /** override the sign-based color (e.g. "#fff" on a dark hero) */
  color?: string;
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
export function AnimatedMoney({ amount, signed, tone, className = "", color, duration = 0.7 }: Props) {
  const numRef = useRef<HTMLSpanElement>(null);
  const signRef = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const signOf = (v: number) => (signed ? (v < 0 ? "-" : v > 0 ? "+" : "") : "");

  useLayoutEffect(() => {
    const numEl = numRef.current;
    const signEl = signRef.current;
    if (!numEl || !signEl) return;
    const render = (v: number) => {
      signEl.textContent = signOf(v);
      numEl.textContent = formatSatang(v);
    };
    if (!canAnimate() || prev.current === amount) {
      render(amount);
      prev.current = amount;
      return;
    }
    const obj = { v: prev.current };
    const tween = gsap.to(obj, {
      v: amount,
      duration,
      ease: "power2.out",
      onUpdate: () => render(Math.round(obj.v)),
    });
    prev.current = amount;
    return () => {
      tween.kill();
    };
    // signOf closes over signed; re-run on amount/signed change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, signed]);

  return (
    <span className={`num ${className}`.trim()} style={{ color: color ?? toneColor(amount, signed, tone) }}>
      <span ref={signRef}>{signOf(amount)}</span>
      <span className="num__baht">฿</span>
      <span ref={numRef}>{formatSatang(amount)}</span>
    </span>
  );
}
