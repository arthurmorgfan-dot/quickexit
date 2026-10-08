import { Target, Zap, ArrowUpRight } from "lucide-react";
const benefits = [
  {
    icon: Target,
    title: "Choose your profit",
    copy: "A number you understand. Set your target in euros or percentage.",
  },
  {
    icon: Zap,
    title: "Exit automatically",
    copy: "When your target is reached, QuickExit closes the position for you.",
  },
  {
    icon: ArrowUpRight,
    title: "Send it home",
    copy: "Your trade ends. Your money can go back to your bank, where it belongs.",
  },
];
export default function Benefits() {
  return (
    <section className="benefits container" aria-label="The QuickExit approach">
      {benefits.map(({ icon: Icon, title, copy }, i) => (
        <div className="benefit" key={title}>
          <div className="benefit-top">
            <span className="icon-box">
              <Icon size={21} />
            </span>
            <span className="tiny-number">0{i + 1}</span>
          </div>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
      ))}
    </section>
  );
}
