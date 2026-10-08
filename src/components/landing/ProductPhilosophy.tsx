import { ArrowUpRight, Landmark, Wallet, ArrowRight } from "lucide-react";
export default function ProductPhilosophy() {
  return (
    <section className="philosophy">
      <div className="container philosophy-inner">
        <div className="philosophy-copy">
          <div className="eyebrow">A TRADE IS A MOMENT. NOT A HOME.</div>
          <h2>
            Your money shouldn’t
            <br />
            live on a <span>trading platform.</span>
          </h2>
          <p>
            QuickExit is being designed around temporary capital for each trade.
            Put money to work with a purpose, then bring it back to your life.
          </p>
          <a className="text-link" href="#product">
            Built around the exit <ArrowUpRight size={17} />
          </a>
        </div>
        <div
          className="money-route"
          aria-label="Money moves from your bank, through one trade, and back home"
        >
          <div className="route-node">
            <Landmark size={23} />
            <span>Your bank</span>
          </div>
          <div className="route-connection">
            <ArrowRight size={19} />
          </div>
          <div className="route-node route-trade">
            <Wallet size={23} />
            <span>One trade</span>
            <small>QuickExit</small>
          </div>
          <div className="route-connection">
            <ArrowRight size={19} />
          </div>
          <div className="route-node">
            <Landmark size={23} />
            <span>Back home</span>
          </div>
          <div className="route-caption">A clear way in. A clear way out.</div>
        </div>
      </div>
    </section>
  );
}
