import { ArrowUpRight } from "lucide-react";
export default function Brand() {
  return (
    <a href="#top" className="brand" aria-label="QuickExit home">
      <span className="brand-symbol">
        <ArrowUpRight size={24} strokeWidth={2.7} />
      </span>
      QuickExit<span className="brand-period">.</span>
    </a>
  );
}
