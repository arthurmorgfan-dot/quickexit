import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section container">
      <div className="section-heading">
        <div>
          <div className="eyebrow">LESS FRICTION. MORE DIRECTION.</div>
          <h2>
            Three steps.
            <br />
            One clear destination.
          </h2>
        </div>
        <p>
          No trading terminal to master.
          <br />
          Just a plan from entry to exit.
        </p>
      </div>
      <div className="steps">
        <article className="step">
          <div className="step-number">
            01 <ArrowRight size={19} />
          </div>
          <div className="step-art funding-art">
            <span className="mini-label">YOUR TRADE AMOUNT</span>
            <span className="funding-value">
              €100<span>.00</span>
            </span>
            <div className="mini-chips">
              <span>€50</span>
              <span className="selected">€100</span>
              <span>€250</span>
            </div>
          </div>
          <h3>Fund one trade</h3>
          <p>
            Choose how much you want to use.
            <br />
            One amount, for one position.
          </p>
        </article>
        <article className="step">
          <div className="step-number">
            02 <ArrowRight size={19} />
          </div>
          <div className="step-art target-art">
            <span className="mini-label">MAKE YOUR EXIT A PLAN</span>
            <div className="target-value">
              +€5<span>profit target</span>
            </div>
            <span className="target-alternative">
              Or keep it simple with +2%
            </span>
          </div>
          <h3>Set your target</h3>
          <p>
            Pick your profit in euros or percentage.
            <br />
            Add downside protection if you want.
          </p>
        </article>
        <article className="step step-exit">
          <div className="step-number">
            03 <ArrowUpRight size={19} />
          </div>
          <div className="step-art exit-art">
            <span className="exit-arrow">
              <ArrowUpRight size={59} strokeWidth={1.7} />
            </span>
            <span className="exit-tag">
              <Check size={13} /> Target reached
            </span>
          </div>
          <h3>
            QuickExit<span>.</span>
          </h3>
          <p>
            When the target is reached, the position closes. Your next move:
            send it home.
          </p>
        </article>
      </div>
    </section>
  );
}
