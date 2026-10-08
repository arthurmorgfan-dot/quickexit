import { useId, useState, type ReactNode, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";

/** Desktop content stays in place; mobile reveals secondary information on demand. */
export default function MobileDisclosure({
  label,
  hint,
  children,
  className = "",
  enabled = true,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const revealInvalidField = (event: FormEvent<HTMLDivElement>) => {
    if (!enabled || open || !window.matchMedia("(max-width: 700px)").matches)
      return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    event.preventDefault();
    setOpen(true);
    window.requestAnimationFrame(() => {
      input.focus();
      input.reportValidity();
    });
  };
  return (
    <div
      className={`qw-mobile-disclosure ${enabled ? "" : "is-disabled"} ${className}`}
      data-open={open}
      onInvalidCapture={revealInvalidField}
    >
      <button
        type="button"
        className="qw-disclosure-trigger"
        hidden={!enabled}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span>
          {label}
          {hint && <small>{hint}</small>}
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id={id} className="qw-disclosure-content">
        {children}
      </div>
    </div>
  );
}
