import "./Segmented.css";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

/** Sliding segmented control. Used for the txn type toggle. */
export function Segmented<T extends string>({ options, value, onChange, label }: Props<T>) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div
      className="seg"
      role="radiogroup"
      aria-label={label}
      style={{ ["--seg-count" as string]: options.length, ["--seg-index" as string]: index }}
    >
      <span className="seg__thumb" aria-hidden="true" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={`seg__opt${o.value === value ? " is-active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
