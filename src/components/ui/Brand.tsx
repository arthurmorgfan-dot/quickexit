import { ArrowUpRight } from "lucide-react";
export default function Brand({ href = "#top" }: { href?: string }) {
  return (
    <a href={href} className="brand" aria-label="QuickExit home">
      <span className="brand-symbol">
        <ArrowUpRight aria-hidden="true" size={24} strokeWidth={2.7} />
      </span>
      QuickExit<span className="brand-period">.</span>
    </a>
  );
}
