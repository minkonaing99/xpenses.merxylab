export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "xpenses.theme.v1";

const THEME_COLORS: Record<Theme, string> = {
  light: "#f4f2fa",
  dark: "#17151d",
};

export function readTheme(storage: Pick<Storage, "getItem"> = localStorage): Theme {
  try {
    return storage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
  meta: Pick<HTMLMetaElement, "content"> | null = document.querySelector<HTMLMetaElement>("#theme-color"),
) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (meta) meta.content = THEME_COLORS[theme];
}

export function saveTheme(
  theme: Theme,
  storage: Pick<Storage, "setItem"> = localStorage,
  root: HTMLElement = document.documentElement,
  meta: Pick<HTMLMetaElement, "content"> | null = document.querySelector<HTMLMetaElement>("#theme-color"),
) {
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked in private browsing. Theme still applies this session.
  }
  applyTheme(theme, root, meta);
}
