import { ArrowUpRight, Check, CircleCheck, Zap } from "lucide-react";
import Button from "../ui/Button";
export function Bitcoin({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`bitcoin ${small ? "bitcoin-small" : ""}`}
      aria-hidden="true"
    >
      ₿
    </span>
  );
}
export function TradeChart() {
  return (
    <svg
      className="trade-chart"
      viewBox="0 0 420 160"
      role="img"
      aria-label="Illustrative Bitcoin position moving toward its profit target"
    >
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#80edb0" stopOpacity=".13" />
          <stop offset="100%" stopColor="#80edb0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 145 H420 M0 100 H420 M0 55 H420"
        stroke="#ffffff"
        strokeOpacity=".045"
      />
      <path
        d="M0 35 H420"
        stroke="#80edb0"
        strokeOpacity=".35"
        strokeDasharray="4 5"
      />
      <path
        d="M0 130 L15 127 L29 136 L42 114 L57 120 L69 100 L83 113 L96 109 L110 119 L126 97 L138 102 L150 82 L163 89 L178 78 L190 96 L204 88 L217 66 L230 79 L244 55 L256 66 L272 57 L283 71 L295 45 L310 56 L321 48 L336 61 L350 42 L365 49 L383 30 L399 43 L420 38 V160 H0Z"
        fill="url(#chart-fill)"
      />
      <path
        d="M0 130 L15 127 L29 136 L42 114 L57 120 L69 100 L83 113 L96 109 L110 119 L126 97 L138 102 L150 82 L163 89 L178 78 L190 96 L204 88 L217 66 L230 79 L244 55 L256 66 L272 57 L283 71 L295 45 L310 56 L321 48 L336 61 L350 42 L365 49 L383 30 L399 43 L420 38"
        stroke="#8bf0b6"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="420" cy="38" r="4" fill="#8bf0b6" />
    </svg>
  );
}
export default function Hero() {
  return (
    <section className="hero container">
      <div className="hero-copy">
        <div className="eyebrow pill">
          <span className="status-dot" /> A clearer way to crypto{" "}
          <span className="pill-divider" /> PRODUCT CONCEPT
        </div>
        <h1>
          Trade it. Profit.
          <br />
          <span>Send it home.</span>
        </h1>
        <p>
          Choose your trade and your profit target. QuickExit automatically
          exits when your target is reached, making it simple to turn a crypto
          position back into money you can send home.
        </p>
        <div className="hero-actions">
          <Button href="/app">Try €10,000 Demo</Button>
          <Button href="#how-it-works" secondary>
            See how it works
          </Button>
        </div>
        <div className="hero-caption">
          <Check size={14} /> €10,000 virtual EUR. No account needed.
        </div>
      </div>
      <div className="hero-visual">
        <div className="visual-label">
          <span className="status-dot" /> ONE TRADE. A CLEAR EXIT.
        </div>
        <div className="trade-card">
          <div className="trade-card-top">
            <div className="coin-name">
              <Bitcoin />
              <div>
                <strong>Bitcoin</strong>
                <span>BTC / EUR</span>
              </div>
            </div>
            <span className="badge">
              <span className="status-dot" /> Active trade
            </span>
          </div>
          <div className="profit-label">
            Current profit <ArrowUpRight size={15} />
          </div>
          <div className="hero-profit">
            +€3.82 <span>+3.82%</span>
          </div>
          <div className="chart-target">
            Your target <span>+€5.00</span>
          </div>
          <TradeChart />
          <div className="chart-axis">
            <span>Trade opened</span>
            <span>Now</span>
          </div>
          <div className="trade-metrics">
            <div>
              <span>Invested</span>
              <strong>€100.00</strong>
            </div>
            <div>
              <span>Profit target</span>
              <strong>+€5.00</strong>
            </div>
          </div>
          <div className="progress-label">
            <span>On the way to your target</span>
            <strong>76%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Progress toward profit target"
            aria-valuenow={76}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span style={{ width: "76%" }} />
          </div>
          <div className="auto-exit">
            <span>
              <Zap size={15} /> Auto-exit enabled
            </span>
            <Check size={15} />
          </div>
        </div>
        <div className="exit-receipt">
          <span className="receipt-icon">
            <CircleCheck size={23} />
          </span>
          <div>
            <strong>Target reached? You’re out.</strong>
            <span>Profit secured. Ready to send home.</span>
          </div>
          <ArrowUpRight size={19} />
        </div>
        <div className="visual-footnote">
          Illustrative trade · No live market data
        </div>
      </div>
    </section>
  );
}
