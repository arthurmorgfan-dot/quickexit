import { useEffect, useId, useRef } from "react";
import {
  cryptoQuantity,
  euro,
  signedEuro,
  priceEuro,
  type Position,
} from "@/lib/demo-trading";
import { paperReceipt, basisPercent } from "@/lib/paper-execution";

export const tradeDate = (p: Position) =>
  p.execution?.exit
    ? new Date(p.execution.exit.closedAt).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Date not recorded";
export const receiptReason = (p: Position) =>
  p.reason === "target"
    ? "Profit target"
    : p.reason === "protection"
      ? "Protection"
      : "Manual sell";

export default function TradeReceipt({
  position: p,
  focus = false,
}: {
  position: Position;
  focus?: boolean;
}) {
  const id = useId(),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);
  const r = p.execution ? paperReceipt(p.amount, p.execution) : null;
  return (
    <article className="qw-trade-receipt" aria-labelledby={id}>
      <div className="qw-card-heading">
        <h3 id={id} tabIndex={-1} ref={heading}>
          {p.asset} paper trade receipt
        </h3>
        <span className="qw-overline">
          {r ? "REALIZED · SIMULATED" : p.example ? "EXAMPLE" : "LEGACY"}
        </span>
      </div>
      <div className="qw-receipt-result">
        <span>Realized {r ? "net" : "recorded"} profit / loss</span>
        <strong className={p.profit < 0 ? "qw-negative" : "qw-positive"}>
          {signedEuro(r?.netProfit ?? p.profit)}
        </strong>
        {r && (
          <small>
            {r.netReturn.toFixed(2)}% net return on invested capital
          </small>
        )}
      </div>
      <dl className="qw-review-details">
        <div>
          <dt>Receipt ID</dt>
          <dd className="qw-receipt-id">
            {r?.id ?? `QE-${p.example ? "example" : "legacy"}-${p.id}`}
          </dd>
        </div>
        <div>
          <dt>Asset</dt>
          <dd>{p.asset}</dd>
        </div>
        <div>
          <dt>Exit reason</dt>
          <dd>{receiptReason(p)}</dd>
        </div>
        <div>
          <dt>Investment</dt>
          <dd>{euro(p.amount)}</dd>
        </div>
        {r && (
          <>
            <div>
              <dt>Opened</dt>
              <dd>{new Date(r.openedAt).toLocaleString("en-GB")}</dd>
            </div>
            <div>
              <dt>Closed</dt>
              <dd>{new Date(r.closedAt).toLocaleString("en-GB")}</dd>
            </div>
            <div>
              <dt>Total simulated costs</dt>
              <dd>{euro(r.totalCosts)}</dd>
            </div>
            <div>
              <dt>Final simulated proceeds</dt>
              <dd>{euro(r.proceeds)}</dd>
            </div>
          </>
        )}
      </dl>
      {r ? (
        <details className="qw-cost-breakdown">
          <summary>Realized after execution · full breakdown</summary>
          <dl>
            {[
              ["Quantity acquired", `${cryptoQuantity(r.quantity)} ${p.asset}`],
              ["Market price at entry", priceEuro(r.entryMarketPrice)],
              [
                "Simulated entry execution price",
                priceEuro(r.entryExecutionPrice),
              ],
              ["Entry fee", euro(r.entryFee)],
              ["Market price at exit", priceEuro(r.exitMarketPrice)],
              [
                "Simulated exit execution price",
                priceEuro(r.exitExecutionPrice),
              ],
              ["Exit fee", euro(r.exitFee)],
              ["Simulated full spread", basisPercent(r.spreadBps)],
              ["Simulated slippage per side", basisPercent(r.slippageBps)],
              ["Entry spread / slippage impact", euro(r.entryPriceImpact)],
              ["Exit spread / slippage impact", euro(r.exitPriceImpact)],
              ["Gross sale proceeds before exit fee", euro(r.grossProceeds)],
              ["Realized gross profit / loss", signedEuro(r.grossProfit)],
              ["Total simulated costs", euro(r.totalCosts)],
              ["Realized net profit / loss", signedEuro(r.netProfit)],
              ["Realized net return", `${r.netReturn.toFixed(2)}%`],
              ["Final simulated proceeds", euro(r.proceeds)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p>
            Gross profit is the change in the quoted value of your acquired
            crypto. Net profit subtracts entry and exit fees and price impact.
            Total costs include these fees and both sides of spread / slippage,
            rounded conservatively to cents. Prices and quantity are displayed
            rounded; the stored fill retains full precision.
          </p>
        </details>
      ) : (
        <p className="qw-micro">
          {p.example
            ? "Illustrative example only; excluded from your simulated balance."
            : "Legacy cost-free paper trade. Original accounting is preserved. Full execution fees, quantity and timestamps were not recorded; they have not been reconstructed."}
        </p>
      )}
      <p className="qw-micro">
        {r
          ? "This receipt is fixed at closure and does not change with later market prices. "
          : ""}
        No real trade, money or bank transfer is represented.
      </p>
    </article>
  );
}
