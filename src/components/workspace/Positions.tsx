import TradeJournal from "./TradeJournal";
import { useState } from "react";
import TradeReceipt, { tradeDate, receiptReason } from "./TradeReceipt";
import { CircleCheck } from "lucide-react";
import { euro, signedEuro, type Position } from "@/lib/demo-trading";
import { AssetMark } from "./MarketCard";
export default function Positions({
  active,
  showActive = true, showCompleted = true,
  completed,
  onMonitor,
  journal, onNote, disabled,
}: {
  active: Position | null;
  showActive?: boolean; showCompleted?: boolean;
  completed: Position[];
  onMonitor: () => void;
  journal: Record<string, string>;
  onNote: (id: number, note: string) => void;
  disabled: boolean;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = completed.find((p) => p.id === selectedId);
  const history = [...completed].sort((a, b) => {
    if (!!a.example !== !!b.example) return a.example ? 1 : -1;
    return (
      (b.execution?.exit?.closedAt ?? 0) - (a.execution?.exit?.closedAt ?? 0) ||
      b.id - a.id
    );
  });
  const receiptButton = (p: Position) => (
    <button
      type="button"
      className="qw-small-action"
      data-receipt-id={p.id}
      aria-label={`View ${p.asset} paper trade receipt ${p.id}`}
      onClick={() => setSelectedId(p.id)}
    >
      View receipt ↗
    </button>
  );
  if (selected)
    return (
      <section className="qw-card qw-history-receipt">
        <button
          type="button"
          className="qw-text-button"
          onClick={() => {
            setSelectedId(null);
            requestAnimationFrame(() => {
              const buttons = document.querySelectorAll<HTMLButtonElement>(
                `[data-receipt-id="${selected.id}"]`,
              );
              Array.from(buttons)
                .find((b) => b.getClientRects().length)
                ?.focus();
            });
          }}
        >
          ← Back to completed trades
        </button>
        <TradeReceipt position={selected} focus />
        {!selected.example && <TradeJournal key={selected.id} note={journal[String(selected.id)] ?? ""} onSave={note => onNote(selected.id, note)} disabled={disabled} />}
      </section>
    );
  const rows = (positions: Position[]) => (
    <div className="qw-table-scroll qw-desktop-positions">
      <table className="qw-positions-table">
        <caption className="sr-only">
          {positions[0]?.status === "active" ? "Active" : "Completed"} simulated
          positions
        </caption>
        <thead>
          <tr>
            <th scope="col">Asset</th>
            <th scope="col">Invested</th>
            <th scope="col">Net P&L</th>
            <th scope="col">
              {positions[0]?.status === "active" ? "Target" : "Closed"}
            </th>
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
                    {p.example ? (
                      <small>Example history</small>
                    ) : p.legacy ? (
                      <small>Legacy · cost-free</small>
                    ) : null}
                  </span>
                </span>
              </th>
              <td>{euro(p.amount)}</td>
              <td className={p.profit >= 0 ? "qw-positive" : "qw-negative"}>
                {signedEuro(p.profit)}
              </td>
              <td>
                {p.status === "active"
                  ? signedEuro(p.target)
                  : p.example
                    ? "Example history"
                    : tradeDate(p)}
              </td>
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
                    {receiptReason(p)}
                  </span>
                )}
                {p.status === "closed" && receiptButton(p)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const cards = (positions: Position[]) => (
    <ul className="qw-mobile-positions">
      {positions.map((p) => (
        <li key={p.id}>
          <div className="qw-mobile-position-top">
            <span className="qw-table-asset">
              <AssetMark asset={p.asset} />
              <span>
                {p.asset}
                <small>
                  {p.example
                    ? "Example history"
                    : p.status === "active"
                      ? "Active position"
                      : tradeDate(p)}
                </small>
              </span>
            </span>
            <span
              className={`qw-mobile-position-profit ${p.profit >= 0 ? "qw-positive" : "qw-negative"}`}
            >
              {signedEuro(p.profit)}
              <small>
                {p.status === "closed" ? "Realized net P&L" : "Net P&L"}
              </small>
            </span>
          </div>
          <dl>
            <div>
              <dt>Invested</dt>
              <dd>{euro(p.amount)}</dd>
            </div>
            <div>
              <dt>Profit target</dt>
              <dd>{signedEuro(p.target)}</dd>
            </div>
          </dl>
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
              <CircleCheck size={14} />
              {receiptReason(p)}
            </span>
          )}
          {p.status === "closed" && receiptButton(p)}
          {p.legacy && (
            <p className="qw-micro">Legacy · cost-free accounting</p>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="qw-positions-view">
      {showActive && <section className="qw-card">
        <div className="qw-card-heading">
          <h2>Active positions</h2>
          <span className="qw-count">{active ? 1 : 0}</span>
        </div>
        {active ? (
          <>
            {rows([active])}
            {cards([active])}
          </>
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
      </section>}
      {showCompleted && <section className="qw-card">
        <div className="qw-card-heading">
          <h2>Completed positions</h2>
          <span className="qw-count">{completed.length}</span>
        </div>
        {rows(history)}
        {cards(history)}
        <p className="qw-micro">
          Example history is illustrative and excluded from your demo balance.
        </p>
      </section>}
    </div>
  );
}
