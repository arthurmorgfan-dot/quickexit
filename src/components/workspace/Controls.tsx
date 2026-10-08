import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
export function ActionButton({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`button ${secondary ? "button-secondary" : "button-primary"}`}
    >
      {children}
      <ArrowUpRight size={16} aria-hidden="true" />
    </button>
  );
}
export function Switch({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}) {
  return (
    <div className="qw-switch-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-track" aria-hidden="true">
          <span />
        </span>
      </button>
    </div>
  );
}
export function ChoiceField({
  label,
  hint,
  options,
  value,
  onChange,
  custom,
  onCustomChange,
  inputId,
  unit = "€",
}: {
  label: string;
  hint?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  custom: string;
  onCustomChange: (value: string) => void;
  inputId: string;
  unit?: string;
}) {
  return (
    <fieldset className="qw-choice">
      <legend>
        {label}
        {hint && <span>{hint}</span>}
      </legend>
      <div className="qw-options">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={value === option ? "is-selected" : ""}
          >
            {option}
          </button>
        ))}
      </div>
      {value === "Custom" && (
        <div className="qw-custom">
          <label htmlFor={inputId}>
            Custom {label.toLowerCase()} ({unit})
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            min="0.01"
            max="10000"
            step="0.01"
            required
            value={custom}
            onChange={(e) => onCustomChange(e.target.value)}
          />
        </div>
      )}
    </fieldset>
  );
}
