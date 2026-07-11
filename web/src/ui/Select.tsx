import "./Select.css";

interface Props {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  label: string;
  /** value to omit (e.g. the other side of a transfer) */
  disabledValue?: string | null;
}

/** Native single-select styled to match the form inputs. */
export function Select({ options, value, onChange, placeholder = "Select", label, disabledValue }: Props) {
  return (
    <div className="sel">
      <select
        className="sel__field"
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.value === disabledValue}>
            {o.label}
          </option>
        ))}
      </select>
      <svg className="sel__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
