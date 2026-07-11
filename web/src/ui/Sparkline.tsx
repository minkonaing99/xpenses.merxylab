interface Props {
  /** series of values; a smooth line is drawn across them. Falls back to a decorative wave. */
  points?: number[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
}

// ponytail: decorative default wave; pass real `points` (e.g. daily net) to wire it to data.
const DEFAULT_WAVE = [8, 5, 9, 4, 7, 3, 8, 5, 10, 6];

/** Lightweight smooth sparkline for the hero card. Pure SVG. */
export function Sparkline({
  points = DEFAULT_WAVE,
  width = 300,
  height = 64,
  stroke = "currentColor",
  strokeWidth = 3,
}: Props) {
  const pad = strokeWidth;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });

  // Catmull-Rom -> cubic bezier for a smooth curve.
  let d = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i - 1] ?? coords[i];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
