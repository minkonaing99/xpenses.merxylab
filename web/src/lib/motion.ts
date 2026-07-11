// Shared motion guard. Animate only when the platform supports matchMedia and
// the user has not asked to reduce motion (vestibular sensitivity). When
// matchMedia is unavailable (SSR, jsdom tests), skip animation and render the
// final state.
export function canAnimate(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
