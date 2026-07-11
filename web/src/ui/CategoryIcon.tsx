import { categoryColor } from "../lib/categoryColor";
import "./CategoryIcon.css";

interface Props {
  /** id drives the color (deterministic) */
  id: string | null | undefined;
  /** shown inside the tile: an emoji icon if present, else the first letter */
  name?: string | null;
  icon?: string | null;
  size?: number;
}

/** Colored rounded tile with a glyph — the finance-app category marker. */
export function CategoryIcon({ id, name, icon, size = 40 }: Props) {
  const glyph = icon || name?.trim()?.[0]?.toUpperCase() || "?";
  return (
    <span
      className="caticon"
      style={{ background: categoryColor(id), width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}
