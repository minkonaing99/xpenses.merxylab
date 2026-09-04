const COLORS = ["var(--cat-a)", "var(--cat-b)", "var(--cat-c)", "var(--cat-d)", "var(--cat-e)", "var(--cat-f)", "var(--cat-g)", "var(--cat-h)"];

export function categoryColor(id: string): string {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}
