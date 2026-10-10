import TradeJournal from "./TradeJournal";
import { useLayoutEffect, useRef, useState } from "react";
import TradeReceipt, { tradeDate, receiptReason } from "./TradeReceipt";
import { CircleCheck } from "lucide-react";
import { euro, signedEuro, type Position } from "@/lib/demo-trading";
import { AssetMark } from "./MarketCard";
export default function Positions({
  active,
  showActive = true, showCompleted = true,
  completed,
  onMonitor,
  journal, onNote, disabled, variant = "standard",
}: {
  active: Position | null;
  showActive?: boolean; showCompleted?: boolean;
  completed: Position[];
  onMonitor: () => void;
  journal: Record<string, string>;
  onNote: (id: number, note: string) => void;
  disabled: boolean;
  variant?: "standard" | "history";
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (selectedId !== null || returnFocus.current === null) return;
    const buttons = container.current?.querySelectorAll<HTMLButtonElement>(`[data-receipt-id="${returnFocus.current}"]`);
    Array.from(buttons ?? []).find(button => button.getClientRects().length > 0)?.focus();
    returnFocus.current = null;
  }, [selectedId]);
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
      <div ref={container} className="qw-card qw-history-receipt">
        <button
          type="button"
          className="qw-text-button"
          onClick={() => {
            returnFocus.current = selected.id;
            setSelectedId(null);
          }}
        >
          ← Back to completed trades
        </button>
        <TradeReceipt position={selected} focus />
        {!selected.example && <TradeJournal key={selected.id} note={journal[String(selected.id)] ?? ""} onSave={note => onNote(selected.id, note)} disabled={disabled} />}
      </div>
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
                {p.example ? "Illustrative P&L" : p.status === "closed" ? "Realized net P&L" : "Net P&L"}
              </small>
            </span>
          </div>
          <dl>
            <div>
              <dt>Invested</dt>
              <dd>{euro(p.amount)}</dd>
            </div>
            <div>
              <dt>{p.status === "closed" ? "Exit reason" : "Profit target"}</dt>
              <dd>{p.status === "closed" ? receiptReason(p) : signedEuro(p.target)}</dd>
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
          ) : variant !== "history" ? (
            <span className="qw-status">
              <CircleCheck size={14} />
              {receiptReason(p)}
            </span>
          ) : null}
          {p.status === "closed" && receiptButton(p)}
          {p.legacy && (
            <p className="qw-micro">Legacy · cost-free accounting</p>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <div ref={container} className={`qw-positions-view ${variant === "history" ? "qh-trades" : ""}`}>
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
        {history.length ? <>{rows(history)}{cards(history)}</> : <div className="qh-empty"><strong>No completed trades to show.</strong><p>Change the filters or explore the labeled examples. Recorded exits will appear here.</p></div>}
        {history.some(p => p.example) && <p className="qw-micro">
          Example history is illustrative and excluded from balances and performance.
        </p>}
      </section>}
    </div>
  );
}
