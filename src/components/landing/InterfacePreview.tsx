"use client";
import { useState } from "react";
import { ArrowUpRight, Check, ShieldCheck, Zap } from "lucide-react";
import { Bitcoin } from "./Hero";
export default function InterfacePreview() {
  const [amount, setAmount] = useState(100),
    [target, setTarget] = useState("+€5"),
    [protection, setProtection] = useState("-€2"),
    [auto, setAuto] = useState(true),
    [message, setMessage] = useState("");
  const targetValue = target.includes("%")
    ? (amount * Number(target.replace(/[^0-9.]/g, ""))) / 100
    : Number(target.replace(/[^0-9.]/g, ""));
  const profit = amount * 0.0382,
    progress = Math.min(100, Math.floor((profit / targetValue) * 100));
  const euro = (value: number) =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  return (
    <section id="product" className="section container product-section">
      <div className="product-copy">
        <div className="eyebrow">MEET YOUR NEXT EXIT.</div>
        <h2>
          A little intention.
          <br />A lot less <span>complexity.</span>
        </h2>
        <p>
          An amount. A target. An exit plan.
          <br />
          Everything you need to make a deliberate trade, without the noise.
        </p>
        <ul className="product-checks">
          <li>
            <Check /> Profit you can understand in euros
          </li>
          <li>
            <Check /> An exit planned before you enter
          </li>
          <li>
            <Check /> Optional protection for the downside
          </li>
        </ul>
        <div className="try-note">
          <span className="note-line" />
          <span>Try the preview. Make it yours.</span>
          <ArrowUpRight size={20} />
        </div>
      </div>
      <div className="interface-panel">
        <div className="interface-header">
          <span>New trade</span>
          <span className="prototype-badge">INTERACTIVE PREVIEW</span>
        </div>
        <div className="interface-coin">
          <div className="coin-name">
            <Bitcoin small />
            <div>
              <strong>
                Bitcoin <span className="ticker">BTC</span>
              </strong>
              <span>
                €63,421.20 <span className="green">+1.24%</span>
              </span>
            </div>
          </div>
        </div>
        <fieldset>
          <legend>
            Buy amount <span>EUR</span>
          </legend>
          <div className="option-grid">
            {[50, 100, 250, 500].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={amount === v}
                className={amount === v ? "selected" : ""}
                onClick={() => {
                  setAmount(v);
                  setMessage("");
                }}
              >
                €{v}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            Profit target <span>Your exit point</span>
          </legend>
          <div className="option-grid">
            {["+€2", "+€5", "+1%", "+2%"].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={target === v}
                className={target === v ? "selected" : ""}
                onClick={() => {
                  setTarget(v);
                  setMessage("");
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            <span className="legend-icon">
              <ShieldCheck size={14} /> Downside protection
            </span>
            <span>Optional</span>
          </legend>
          <div className="option-grid protection-options">
            {["-€2", "-€5"].map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={protection === v}
                aria-label={`${v} downside protection${protection === v ? ", select again to disable" : ""}`}
                className={protection === v ? "selected" : ""}
                onClick={() => {
                  setProtection(protection === v ? "" : v);
                  setMessage("");
                }}
              >
                {v}
              </button>
            ))}
            <span>Limit your downside</span>
          </div>
        </fieldset>
        <div className="toggle-row">
          <span>
            <Zap size={15} /> Auto-exit{" "}
            <small>Let your target do the work.</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={auto}
            aria-label="Auto-exit"
            className={`toggle ${auto ? "on" : ""}`}
            onClick={() => {
              setAuto(!auto);
              setMessage("");
            }}
          >
            <span className="toggle-track" aria-hidden="true">
              <span />
            </span>
          </button>
        </div>
        <div className="preview-profit">
          <div>
            <span>Current profit</span>
            <strong>+{euro(profit)}</strong>
          </div>
          <div>
            <span>Target</span>
            <strong>+{euro(targetValue)}</strong>
          </div>
          <div className="preview-progress">
            <span>Progress to target</span>
            <strong>{progress}%</strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Illustrative profit progress"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${progress}% of the illustrative ${euro(targetValue)} profit target`}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <button
          className="button button-primary buy-button"
          type="button"
          onClick={() =>
            setMessage(
              `Preview only: ${euro(amount)} in BTC, ${target} profit target${protection ? `, ${protection} protection` : ", no downside protection"}, auto-exit ${auto ? "on" : "off"}. No money moved or order placed.`,
            )
          }
        >
          {auto ? "Buy & Auto-Exit" : "Preview Buy"}
          <ArrowUpRight size={17} />
        </button>
        <p className="preview-disclaimer">
          Product concept. No real trades or funds.
        </p>
        <p
          role="status"
          aria-atomic="true"
          className={message ? "preview-message" : "sr-only"}
        >
          {message}
        </p>
      </div>
    </section>
  );
}
