import type { TxnTemplate } from "./templates";

const KEY = "xpenses.favorite-templates.v1";
const TYPES = new Set(["expense", "income"]);

function valid(value: unknown): value is TxnTemplate {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return TYPES.has(String(item.type))
    && Number.isInteger(item.amount) && Number(item.amount) > 0
    && (item.note === null || typeof item.note === "string")
    && (item.categoryId === null || typeof item.categoryId === "string")
    && (item.accountId === null || typeof item.accountId === "string");
}

export function templateKey(template: TxnTemplate): string {
  return JSON.stringify([
    template.type,
    template.amount,
    template.accountId,
    template.categoryId,
    template.note,
  ]);
}

export function readFavoriteTemplates(storage: Pick<Storage, "getItem"> = localStorage): TxnTemplate[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, 4).map((item) => ({ ...item })) : [];
  } catch {
    return [];
  }
}

export function writeFavoriteTemplates(
  templates: TxnTemplate[],
  storage: Pick<Storage, "setItem"> = localStorage,
): void {
  storage.setItem(KEY, JSON.stringify(templates.slice(0, 4).map((item) => ({ ...item }))));
}

export function toggleFavoriteTemplate(favorites: TxnTemplate[], template: TxnTemplate): TxnTemplate[] {
  const key = templateKey(template);
  const exists = favorites.some((item) => templateKey(item) === key);
  if (exists) return favorites.filter((item) => templateKey(item) !== key);
  return [{ ...template }, ...favorites].slice(0, 4);
}

export function mergeTemplates(favorites: TxnTemplate[], recent: TxnTemplate[]): TxnTemplate[] {
  const favoriteKeys = new Set(favorites.map(templateKey));
  return [...favorites, ...recent.filter((item) => !favoriteKeys.has(templateKey(item)))].slice(0, 6);
}
