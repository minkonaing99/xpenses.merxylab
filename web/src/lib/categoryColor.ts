// Deterministic color per category (or account) id, drawn from the token
// palette --cat-a..--cat-h. Same id -> same color across the app.
const CAT_VARS = [
  "--cat-a",
  "--cat-b",
  "--cat-c",
  "--cat-d",
  "--cat-e",
  "--cat-f",
  "--cat-g",
  "--cat-h",
] as const;

export function categoryColorVar(id: string | null | undefined): string {
  if (!id) return CAT_VARS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CAT_VARS[h % CAT_VARS.length];
}

/** CSS color value, e.g. "var(--cat-c)". */
export function categoryColor(id: string | null | undefined): string {
  return `var(${categoryColorVar(id)})`;
}
