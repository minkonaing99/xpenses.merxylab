import "./Chips.css";

interface Props {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  /** value to disable (e.g. the account already chosen on the other side of a transfer) */
  disabledValue?: string | null;
}

/** Horizontal, scrollable single-select chips. */
export function Chips({ options, value, onChange, disabledValue }: Props) {
  if (options.length === 0) {
    return <p className="chips__empty">None yet.</p>;
  }
  return (
    <div className="chips" role="listbox">
      {options.map((o) => {
        const disabled = o.value === disabledValue;
        return (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={o.value === value}
            disabled={disabled}
            className={`chip${o.value === value ? " is-on" : ""}`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
