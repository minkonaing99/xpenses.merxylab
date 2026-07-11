// The Money/AnimatedMoney readout renders the ฿ sign in its own span, so the
// full string ("฿200.00") is split across child nodes and getByText's default
// per-element matcher misses it. This matches on the .num wrapper's textContent.
export function money(text: string) {
  const want = text.replace(/\s+/g, "");
  return (_content: string, el: Element | null): boolean =>
    !!el && el.classList.contains("num") && (el.textContent ?? "").replace(/\s+/g, "") === want;
}
