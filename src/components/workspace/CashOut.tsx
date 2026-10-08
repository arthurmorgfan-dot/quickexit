import { CircleCheck, Landmark, ArrowRight, ShieldCheck } from "lucide-react";
import { euro } from "@/lib/demo-trading";
import { ActionButton } from "./Controls";
export default function CashOut({
  cash,
  lastTransfer,
  sent,
  onTransfer,
  onTrade,
}: {
  cash: number;
  lastTransfer: number;
  sent: number;
  onTransfer: () => void;
  onTrade: () => void;
}) {
  const success = lastTransfer > 0 && cash === 0;
  return (
    <div className="qw-cash-layout">
      <section className={`qw-card qw-cash-card ${success ? "is-sent" : ""}`}>
        <div className={`qw-closed-icon ${success ? "" : "qw-bank-icon"}`}>
          {success ? <CircleCheck size={32} /> : <Landmark size={30} />}
        </div>
        <span className="qw-overline">
          {success ? "RIGHT WHERE IT BELONGS" : "A TRADE ENDS. MONEY LEAVES."}
        </span>
        <h2>
          {success ? `${euro(lastTransfer)} sent home` : "Bring it back home."}
        </h2>
        <p>
          {success
            ? "Your demo transfer is complete. Your available trading cash is back to zero."
            : "Close your trade, then send the proceeds back to your bank. No reason to leave money sitting here."}
        </p>
        <div className="qw-cash-total">
          <span>Available to send</span>
          <strong>{euro(cash)}</strong>
          <small>Simulated balance</small>
        </div>
        <div className="qw-bank-destination">
          <span className="qw-event-icon">
            <Landmark size={19} />
          </span>
          <div>
            <strong>Demo bank account</strong>
            <span>•••• 4821 · Placeholder account</span>
          </div>
          <span className="qw-badge">DEMO</span>
        </div>
        {cash > 0 ? (
          <ActionButton onClick={onTransfer}>
            Send {euro(cash)} to Bank
          </ActionButton>
        ) : (
          <ActionButton onClick={onTrade}>
            {success ? "Start a fresh trade" : "Explore a trade"}
          </ActionButton>
        )}
        <p className="qw-micro">
          No bank connection. No real transfer. No banking information
          collected.
        </p>
      </section>
      <aside className="qw-cash-context">
        <span className="qw-overline">THE QUICKEXIT PRINCIPLE</span>
        <h2>
          Your money has
          <br />
          better places to be.
        </h2>
        <p>
          Temporary capital, for one purposeful trade. Then back to your life.
        </p>
        <div className="qw-money-loop">
          <span>One trade</span>
          <ArrowRight size={17} />
          <span>Your bank</span>
        </div>
        <div className="qw-card qw-sent-summary">
          <span>Sent home this demo</span>
          <strong>{euro(sent)}</strong>
          <small>Simulated transfers only</small>
        </div>
        <p className="qw-risk-note">
          <ShieldCheck size={16} /> A future live service would depend on
          appropriate licensed payment partners. No integrations are live.
        </p>
      </aside>
    </div>
  );
}
