import { euro, signedEuro, priceEuro, type Position } from "@/lib/demo-trading";
import { valuePaper, priceForNetProfit } from "@/lib/paper-execution";
export default function ExecutionBreakdown({
  position: p,
}: {
  position: Position;
}) {
  if (!p.execution)
    return p.legacy ? (
      <p className="qw-micro">
        Legacy paper trade · original cost-free assumptions retained.
      </p>
    ) : null;
  const x = p.execution,
    v = x.exit ?? valuePaper(p.amount, x);
  return (
    <details className="qw-cost-breakdown">
      <summary>
        {x.exit ? "Paper execution breakdown" : "Estimated trading costs"}
      </summary>
      <dl>
        {[
          ["Investment", euro(p.amount)],
          ["Entry cost", euro(v.entryCost)],
          [x.exit ? "Exit cost" : "Estimated exit cost", euro(v.exitCost)],
          ["Gross profit", signedEuro(v.grossProfit)],
          ["Net profit", signedEuro(v.netProfit)],
          ["Quoted entry price", priceEuro(x.entry.quotedPrice)],
          ["Paper entry execution", priceEuro(x.entry.executionPrice)],
          ["Entry fee", euro(x.entry.fee)],
          ["Crypto acquired", `${x.entry.quantity.toFixed(8)} ${p.asset}`],
          ["Gross market value", euro(v.grossMarketValue)],
          [
            x.exit ? "Paper exit execution" : "Estimated exit execution",
            priceEuro(v.exitExecutionPrice),
          ],
          [x.exit ? "Exit fee" : "Estimated exit fee", euro(v.exitFee)],
          [
            "Net target market price",
            priceEuro(priceForNetProfit(p.amount, x, p.target)),
          ],
          ["Opened", new Date(x.entry.openedAt).toLocaleString("en-GB")],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        Costs include simulated fees and price impact from spread and slippage.
        Gross profit is the change in the acquired crypto’s quoted value. Net
        profit subtracts entry and exit costs. These are estimates; real
        execution can differ.
      </p>
    </details>
  );
}
