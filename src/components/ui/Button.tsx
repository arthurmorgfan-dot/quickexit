import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
export default function Button({
  children,
  href = "#product",
  secondary = false,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <a
      className={`button ${secondary ? "button-secondary" : "button-primary"} ${className}`}
      href={href}
    >
      {children}
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  );
}
