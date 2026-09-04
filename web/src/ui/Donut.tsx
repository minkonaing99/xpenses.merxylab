export interface DonutSegment {
  value: number;
  color: string; // any CSS color, e.g. "var(--cat-b)"
  label?: string;
  onSelect?: () => void;
}

interface Props {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}

/**
 * Pure-SVG donut chart. No charting dependency — each segment is a circle with
 * a stroke-dasharray arc, offset by the running total. Starts at 12 o'clock.
 */
export function Donut({ segments, size = 208, thickness = 30 }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      role={segments.some((segment) => segment.onSelect) ? "group" : "img"}
      aria-label="Spending by category">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-sunken)" strokeWidth={thickness} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = frac * c;
          const el = (
            <g key={i}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-acc * c}
            />
            {s.onSelect && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="transparent"
              strokeWidth={44} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc * c}
              role="button" aria-label={s.label} tabIndex={0} onClick={s.onSelect}
              onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && s.onSelect?.()} />}
            </g>
          );
          acc += frac;
          return el;
        })}
      </g>
    </svg>
  );
}
