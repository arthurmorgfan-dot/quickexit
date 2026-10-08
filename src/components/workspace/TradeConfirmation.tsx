import { useEffect, useRef } from "react";
import {
  ASSETS,
  euro,
  priceEuro,
  signedEuro,
  type Asset,
} from "@/lib/demo-trading";
import { basisPercent, estimatePaperTrade } from "@/lib/paper-execution";
import { ActionButton } from "./Controls";

export default function TradeConfirmation({
  asset,
  amount,
  target,
  targetLabel,
  protection,
  autoExit,
  price,
  disabled,
  live,
  notice,
  onConfirm,
  onBack,
}: {
  asset: Asset;
  amount: number;
  target: number;
  targetLabel: string;
  protection: number | null;
  autoExit: boolean;
  price: number;
  disabled: boolean;
  live: boolean;
  notice?: string;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const e = estimatePaperTrade(amount, price, target);
  return (
    <section
      className="qw-card qw-trade-confirmation"
      aria-labelledby="confirm-trade-title"
    >
      <div className="qw-card-heading">
        <h2 id="confirm-trade-title" tabIndex={-1} ref={heading}>
          Review your paper trade.
        </h2>
        <span className="qw-overline">SIMULATED</span>
      </div>
      <p className="qw-form-intro">
        No real money. A clear plan before you begin.
      </p>
      <div className="qw-confirm-outcome">
        <span>
          {ASSETS[asset].name} · {asset}
        </span>
        <strong>{euro(amount)}</strong>
        <p>
          Aim for <b>{signedEuro(e.atTarget.netProfit)}</b> net profit after
          simulated costs.
        </p>
      </div>
      <dl className="qw-review-details">
        <div>
          <dt>Quoted market price</dt>
          <dd>{priceEuro(price)}</dd>
        </div>
        <div>
          <dt>Profit target</dt>
          <dd>{targetLabel}</dd>
        </div>
        <div>
          <dt>Estimated net return at target</dt>
          <dd>{e.targetNetReturn.toFixed(2)}%</dd>
        </div>
        <div>
          <dt>Target market price</dt>
          <dd>{priceEuro(e.targetPrice)}</dd>
        </div>
        <div>
          <dt>Protection</dt>
          <dd>
            {protection === null ? "Off" : `−${euro(protection)} net loss`}
          </dd>
        </div>
        <div>
          <dt>Auto-Exit</dt>
          <dd>
            {autoExit
              ? "On · closes at target"
              : "Off · you choose when to sell"}
          </dd>
        </div>
      </dl>
      <details className="qw-cost-breakdown">
        <summary>Estimated before execution</summary>
        <dl>
          {[
            ["Current quoted market price", priceEuro(price)],
            [
              "Estimated entry execution price",
              priceEuro(e.execution.entry.executionPrice),
            ],
            ["Estimated entry fee", euro(e.execution.entry.fee)],
            ["Estimated future exit fee at target", euro(e.atTarget.exitFee)],
            ["Entry spread / slippage impact", euro(e.entryPriceImpact)],
            [
              "Estimated exit spread / slippage at target",
              euro(e.targetExitPriceImpact),
            ],
            [
              "Simulated full spread",
              basisPercent(e.execution.costs.spreadBps),
            ],
            [
              "Simulated slippage per side",
              basisPercent(e.execution.costs.slippageBps),
            ],
            ["Break-even market price", priceEuro(e.breakEvenPrice)],
            ["Estimated final proceeds at target", euro(e.atTarget.proceeds)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p>
          Estimates use the same fee and price-impact assumptions as the paper
          engine. The full spread is split across entry and exit. Percentage
          targets are net returns on your entire investment. Displayed prices
          are rounded; execution uses full precision.
        </p>
      </details>
      <p className="qw-micro">
        {live
          ? "Live estimates follow the latest available market quote. "
          : "Demo estimates use the demo quote. "}
        The realized paper fill and closing costs are recorded after execution.
        Targets and protection are not guaranteed.
      </p>
      {protection !== null && e.opening.netProfit <= -protection && (
        <p className="qw-error" role="status">
          Opening costs already meet your protection level. This trade would
          close immediately. Go back to choose wider protection.
        </p>
      )}
      {notice && (
        <p className="qw-error" role="alert">
          {notice}
        </p>
      )}
      {disabled && (
        <p className="qw-error" role="status">
          Waiting for a usable market quote. No trade has been opened.
        </p>
      )}
      <div className="qw-confirm-actions">
        <ActionButton onClick={onConfirm} disabled={disabled}>
          Confirm Paper Trade
        </ActionButton>
        <ActionButton secondary onClick={onBack}>
          Go Back
        </ActionButton>
      </div>
      <p className="qw-micro">
        All funds, trades and transfers remain simulated.
      </p>
    </section>
  );
}
