// Brand mark + wordmark. The mark mirrors public/icon.svg: a bicolor "x"
// (ink stroke over gold stroke). Strokes use theme tokens so it tracks the
// live palette.
import "./Logo.css";

interface LogoMarkProps {
  size?: number;
  title?: string;
}

export function LogoMark({ size = 32, title = "xpenses" }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label={title}>
      <g fill="none" strokeWidth={58} strokeLinecap="round">
        <path d="M168 168 L344 344" stroke="var(--ink)" />
        <path d="M344 168 L168 344" stroke="var(--accent)" />
      </g>
    </svg>
  );
}

/** "xpenses" wordmark; the leading x is amber via ::first-letter (see Logo.css). */
export function Wordmark({ className }: { className?: string }) {
  return <span className={`wordmark${className ? ` ${className}` : ""}`}>xpenses</span>;
}
