import './ProgressBar.css'

interface ProgressBarProps {
  value: number
  max: number
  color: string
  height?: number
}

// CSS-only proportion bar — no charting dependency for a single-bar breakdown
// (see docs/TECH.md §17 chart rationale).
export function ProgressBar({ value, max, color, height = 6 }: ProgressBarProps) {
  const percent = max === 0 ? 0 : Math.min(100, (value / max) * 100)
  return (
    <div className="progress-bar" style={{ height }}>
      <div className="progress-bar__fill" style={{ width: `${percent}%`, background: color }} />
    </div>
  )
}
