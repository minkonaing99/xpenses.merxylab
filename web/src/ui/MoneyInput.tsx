interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  autoFocus?: boolean;
  allowNegative?: boolean;
}

/**
 * Baht entry field. Forces the mobile decimal numpad (not the full keyboard):
 * inputMode="decimal" is the modern trigger; type=text keeps controlled decimal
 * entry sane (type=number drops a trailing "."); pattern nudges stubborn keyboards.
 */
export function MoneyInput({ value, onChange, placeholder = "0.00", ariaLabel, className, autoFocus, allowNegative = false }: Props) {
  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      pattern={allowNegative ? "-?[0-9]*[.,]?[0-9]*" : "[0-9]*[.,]?[0-9]*"}
      enterKeyHint="done"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
    />
  );
}
