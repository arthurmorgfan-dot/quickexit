import { useState, type Dispatch, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  CircleCheck,
  Pencil,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  euro,
  signedEuro,
  priceEuro,
  currentPrice,
  profitPercent,
  progress,
  reasonLabel,
  type Position,
  type DemoAction,
} from "@/lib/demo-trading";
import { ActionButton, Switch } from "./Controls";
import MobileDisclosure from "./MobileDisclosure";
export function ActivePosition({
  position: p,
  dispatch,
  playing,
  live = false,
}: {
  position: Position;
  dispatch: Dispatch<DemoAction>;
  playing: boolean;
  live?: boolean;
}) {
  const [editing, setEditing] = useState(false),
    [target, setTarget] = useState(String(p.target / 100)),
    [error, setError] = useState("");
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = Math.round(Number(target) * 100);
    if (!Number.isFinite(value) || value < 1 || value > 1000000) {
      setError("Enter a target between €0.01 and €10,000.");
      return;
    }
    dispatch({ type: "EDIT_TARGET", target: value });
    setEditing(false);
    setError("");
  };
  return (
    <section className="qw-card qw-active" aria-labelledby="active-title">
      <div className="qw-card-heading">
        <h2 id="active-title">Your {p.asset} position</h2>
        <span className="qw-badge">
          <span className="status-dot" /> ACTIVE
        </span>
      </div>
      <div className="qw-profit-label">Current profit</div>
      <div className={`qw-profit ${p.profit < 0 ? "qw-negative" : ""}`}>
        {signedEuro(p.profit)}
        <span>
          {p.profit >= 0 ? "+" : ""}
          {profitPercent(p)}%
        </span>
      </div>
      <div className="qw-position-progress">
        <span>
          Target <strong>{signedEuro(p.target)}</strong>
        </span>
        <strong>{progress(p)}%</strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="Profit target progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress(p)}
        aria-valuetext={`${signedEuro(p.profit)} profit, target ${signedEuro(p.target)}`}
      >
        <span style={{ width: `${progress(p)}%` }} />
      </div>
      <p className="qw-exit-hint">
        {p.profit >= p.target && !p.autoExit
          ? "Target reached. Auto-exit is off; sell when you’re ready."
          : p.profit < 0
            ? "Your position is below its starting value."
            : p.autoExit
              ? "When you reach your target, your position closes automatically."
              : "Auto-exit is off. You choose when to close this position."}
      </p>
      <div className={`qw-mobile-exit-status ${p.autoExit ? "" : "is-off"}`}>
        <Zap size={15} />
        <span>
          Auto-exit <strong>{p.autoExit ? "enabled" : "off"}</strong>
        </span>
      </div>
      <dl className="qw-mobile-position-summary">
        <div>
          <dt>Invested</dt>
          <dd>{euro(p.amount)}</dd>
        </div>
        <div>
          <dt>Current value</dt>
          <dd>{euro(p.amount + p.profit)}</dd>
        </div>
      </dl>
      <MobileDisclosure
        label="Position details"
        hint={
          p.protection === null
            ? "No downside protection"
            : `Protection −${euro(p.protection)}`
        }
        className="qw-position-disclosure"
      >
        <dl className="qw-position-details">
          <div>
            <dt>Invested</dt>
            <dd>{euro(p.amount)}</dd>
          </div>
          <div>
            <dt>Current value</dt>
            <dd>{euro(p.amount + p.profit)}</dd>
          </div>
          <div>
            <dt>Entry price</dt>
            <dd>{priceEuro(p.entryPrice)}</dd>
          </div>
          <div>
            <dt>Current price</dt>
            <dd>{priceEuro(currentPrice(p))}</dd>
          </div>
          <div>
            <dt>
              <ShieldCheck size={12} /> Protection
            </dt>
            <dd>{p.protection === null ? "None" : `−${euro(p.protection)}`}</dd>
          </div>
          <div>
            <dt>
              <Zap size={12} /> Auto-exit
            </dt>
            <dd className={p.autoExit ? "qw-positive" : ""}>
              {p.autoExit ? "Enabled" : "Off"}
            </dd>
          </div>
        </dl>
      </MobileDisclosure>
      <div className="qw-position-actions">
        <ActionButton onClick={() => dispatch({ type: "SELL" })}>
          Sell Now
        </ActionButton>
        <button
          type="button"
          className="qw-edit-button"
          aria-expanded={editing}
          aria-controls="edit-target-form"
          onClick={() => {
            setTarget(String(p.target / 100));
            setEditing(!editing);
            setError("");
            if (!editing && window.matchMedia("(max-width: 700px)").matches) {
              window.requestAnimationFrame(() => {
                const input = document.getElementById("edit-target");
                input?.focus();
                input
                  ?.closest("form")
                  ?.scrollIntoView({ block: "center", behavior: "instant" });
              });
            }
          }}
        >
          <Pencil size={13} /> Edit Target
        </button>
      </div>
      <form
        id="edit-target-form"
        className="qw-edit-form"
        hidden={!editing}
        onSubmit={save}
      >
        <label htmlFor="edit-target">New profit target (€)</label>
        <div>
          <input
            id="edit-target"
            type="number"
            min="0.01"
            max="10000"
            step="0.01"
            inputMode="decimal"
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <button type="submit" className="qw-small-action">
            Save target
          </button>
        </div>
        <p>
          If auto-exit is on, a target at or below your current profit closes
          the trade immediately.
        </p>
        {error && (
          <p role="alert" className="qw-error">
            {error}
          </p>
        )}
      </form>
      {!live && (
        <MobileDisclosure
          label="Try a demo outcome"
          hint="Raise profit, lower it, or reach your target"
          className="qw-demo-disclosure"
        >
          <div className="qw-demo-controls">
            <div className="qw-demo-title">
              <span>DEMO CONTROLS</span>
              <span>Try an outcome</span>
            </div>
            <div className="qw-demo-options">
              <button
                type="button"
                onClick={() => dispatch({ type: "MOVE", mode: "rise" })}
              >
                <TrendingUp size={13} /> Profit rises
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "MOVE", mode: "fall" })}
              >
                <TrendingDown size={13} /> Profit falls
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "MOVE", mode: "target" })}
              >
                <Check size={13} /> Reach target
              </button>
            </div>
            <Switch
              label="Subtle price movement"
              description="Pause to explore at your own pace."
              checked={playing}
              onChange={(value) => dispatch({ type: "PLAY", value })}
            />
          </div>
        </MobileDisclosure>
      )}
      <p className="qw-micro">
        Simulation only. Real targets and protection are not guaranteed.
      </p>
    </section>
  );
}
export function ClosedPosition({
  position: p,
  cash,
  onCashOut,
  onNewTrade,
}: {
  position: Position;
  cash: number;
  onCashOut: () => void;
  onNewTrade: () => void;
}) {
  const success = p.profit >= 0;
  return (
    <section
      className={`qw-card qw-closed ${success ? "" : "is-loss"}`}
      aria-labelledby="closed-title"
    >
      <div className="qw-closed-icon">
        {success ? <CircleCheck size={32} /> : <ShieldCheck size={32} />}
      </div>
      <span className="qw-overline">{p.asset} · TRADE COMPLETE</span>
      <h2 id="closed-title">{reasonLabel(p)}</h2>
      <div className={`qw-profit ${success ? "" : "qw-negative"}`}>
        {signedEuro(p.profit)}
        <span>{success ? "profit" : "loss"}</span>
      </div>
      <p>
        Position closed {p.reason === "manual" ? "manually" : "automatically"}.
        <br />
        Your next move is closer to home.
      </p>
      <dl className="qw-close-receipt">
        <div>
          <dt>Your investment</dt>
          <dd>{euro(p.amount)}</dd>
        </div>
        <div>
          <dt>{success ? "Profit" : "Loss"}</dt>
          <dd className={success ? "qw-positive" : "qw-negative"}>
            {signedEuro(p.profit)}
          </dd>
        </div>
        <div>
          <dt>Trade proceeds</dt>
          <dd>{euro(p.amount + p.profit)}</dd>
        </div>
        <div>
          <dt>Available to send home</dt>
          <dd>{euro(cash)}</dd>
        </div>
      </dl>
      <ActionButton onClick={onCashOut} disabled={cash === 0}>
        Send to Bank
      </ActionButton>
      <button type="button" className="qw-text-button" onClick={onNewTrade}>
        Plan another trade <ArrowUpRight size={13} />
      </button>
      <p className="qw-micro">
        Simulated proceeds. No real trade was executed.
      </p>
    </section>
  );
}
