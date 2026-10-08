import { CircleCheck } from "lucide-react";
import {
  euro,
  signedEuro,
  reasonLabel,
  type Position,
} from "@/lib/demo-trading";
import { AssetMark } from "./MarketCard";
export default function Positions({
  active,
  completed,
  onMonitor,
}: {
  active: Position | null;
  completed: Position[];
  onMonitor: () => void;
}) {
  const rows = (positions: Position[]) => (
    <div className="qw-table-scroll">
      <table className="qw-positions-table">
        <caption className="sr-only">
          {positions[0]?.status === "active" ? "Active" : "Completed"} simulated
          positions
        </caption>
        <thead>
          <tr>
            <th scope="col">Asset</th>
            <th scope="col">Invested</th>
            <th scope="col">Profit / loss</th>
            <th scope="col">Target</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id}>
              <th scope="row">
                <span className="qw-table-asset">
                  <AssetMark asset={p.asset} />
                  <span>
                    {p.asset}
                    {p.example && <small>Example history</small>}
                  </span>
                </span>
              </th>
              <td>{euro(p.amount)}</td>
              <td className={p.profit >= 0 ? "qw-positive" : "qw-negative"}>
                {signedEuro(p.profit)}
              </td>
              <td>{signedEuro(p.target)}</td>
              <td>
                {p.status === "active" ? (
                  <button
                    type="button"
                    className="qw-small-action"
                    onClick={onMonitor}
                  >
                    Monitor position ↗
                  </button>
                ) : (
                  <span className="qw-status">
                    <CircleCheck size={12} />
                    {reasonLabel(p)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="qw-positions-view">
      <section className="qw-card">
        <div className="qw-card-heading">
          <h2>Active positions</h2>
          <span className="qw-count">{active ? 1 : 0}</span>
        </div>
        {active ? (
          rows([active])
        ) : (
          <div className="qw-empty">
            <span>No open positions.</span>
            <p>One purposeful trade starts with an amount and a target.</p>
            <button
              type="button"
              className="qw-text-button"
              onClick={onMonitor}
            >
              Choose your trade ↗
            </button>
          </div>
        )}
      </section>
      <section className="qw-card">
        <div className="qw-card-heading">
          <h2>Completed positions</h2>
          <span className="qw-count">{completed.length}</span>
        </div>
        {rows(completed)}
        <p className="qw-micro">
          Example history is illustrative and excluded from your demo balance.
        </p>
      </section>
    </div>
  );
}
