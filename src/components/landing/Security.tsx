import {
  ShieldCheck,
  LockKeyhole,
  Building2,
  ArrowUpRight,
} from "lucide-react";
export default function Security() {
  return (
    <section id="security" className="section container security-section">
      <div className="security-intro">
        <span className="security-emblem">
          <ShieldCheck size={30} strokeWidth={1.5} />
        </span>
        <div className="eyebrow">TRUST IS PART OF THE PRODUCT.</div>
        <h2>
          Simple on the surface.
          <br />
          Serious underneath.
        </h2>
        <p>
          We’re designing QuickExit so that execution, custody, and payments can
          ultimately be supported by appropriate licensed partners.
        </p>
      </div>
      <div className="trust-grid">
        <article>
          <Building2 size={21} />
          <h3>The right infrastructure</h3>
          <p>
            Designed for future integration with licensed execution, custody,
            and payment providers.
          </p>
        </article>
        <article>
          <LockKeyhole size={21} />
          <h3>Clarity, from the start</h3>
          <p>
            Understand your amount, target, and protection before a trade
            begins. No hidden complexity.
          </p>
        </article>
        <article>
          <ArrowUpRight size={21} />
          <h3>A deliberate way out</h3>
          <p>
            A product built around closing the trade and giving your money a
            route back home.
          </p>
        </article>
      </div>
      <p className="security-disclaimer">
        QuickExit is a product prototype. It is not currently a licensed or
        operational trading service. Partner integrations are not yet live.
      </p>
    </section>
  );
}
