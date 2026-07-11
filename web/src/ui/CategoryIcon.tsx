import "./CategoryIcon.css";

interface Props {
  /** kept for call-site stability; color now follows the theme accent */
  id?: string | null;
  /** shown inside the tile: an emoji icon if present, else the first letter */
  name?: string | null;
  icon?: string | null;
  size?: number;
}

/** Rounded tile with a glyph, in the theme accent — the category marker. */
export function CategoryIcon({ name, icon, size = 40 }: Props) {
  const glyph = icon || name?.trim()?.[0]?.toUpperCase() || "?";
  return (
    <span
      className="caticon"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}
