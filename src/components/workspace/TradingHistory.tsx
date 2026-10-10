import { useState } from "react";
import { ASSETS, signedEuro, type DemoState } from "@/lib/demo-trading";
import { performanceStatistics } from "@/lib/portfolio-performance";
import { filterTrades, initialHistoryFilters, type HistoryFilters } from "@/lib/trading-history";
import Positions from "./Positions";

export default function TradingHistory({ state, cloud, onNote, disabled }: {
  state: DemoState; cloud: boolean; onNote: (id: number, note: string) => void; disabled: boolean;
}) {
  const [filters, setFilters] = useState<HistoryFilters>(initialHistoryFilters);
  const stats = performanceStatistics(state);
  const trades = filterTrades(state.completed, filters);
  const change = <K extends keyof HistoryFilters>(key: K, value: HistoryFilters[K]) => setFilters(current => ({ ...current, [key]: value }));
  const invalidDates = !!(filters.from && filters.to && filters.from > filters.to);
  return <div className="qh-history">
    <section className="qh-overview" aria-label="Completed paper trade performance">
      <div className="qh-overview-heading"><strong>Trading journal</strong><span className="qw-badge">{cloud ? "ACCOUNT · SIMULATED" : "DEMO · LOCAL"}</span></div>
      <dl className="qh-metrics">
        <div><dt>Realized net P&amp;L</dt><dd className={stats.realized < 0 ? "qw-negative" : "qw-positive"}>{signedEuro(stats.realized)}</dd></div>
        <div><dt>Completed trades</dt><dd>{stats.completed}</dd></div>
        <div><dt>Win rate</dt><dd>{stats.winRate === null ? "—" : `${stats.winRate.toFixed(1)}%`}</dd></div>
      </dl>
      <p className="qw-micro">All actual completed {cloud ? "account" : "Demo"} trades · net of recorded costs. Examples excluded. Win rate includes breakeven trades.</p>
    </section>
    <section className="qh-explorer" aria-label="Trade history filters">
      <div className="qh-filters">
        <label>Records<select aria-label="Records" value={filters.records} onChange={e => change("records", e.target.value as HistoryFilters["records"])}><option value="actual">Actual trades</option><option value="examples">Examples</option><option value="all">All records</option></select></label>
        <label>Asset<select aria-label="Asset" value={filters.asset} onChange={e => change("asset", e.target.value as HistoryFilters["asset"])}><option value="all">All assets</option>{Object.keys(ASSETS).map(asset => <option key={asset}>{asset}</option>)}</select></label>
        <label>Result<select aria-label="Result" value={filters.result} onChange={e => change("result", e.target.value as HistoryFilters["result"])}><option value="all">All results</option><option value="profit">Profit</option><option value="loss">Loss</option><option value="even">Breakeven</option></select></label>
        <label>From<input aria-label="From" type="date" value={filters.from} onChange={e => change("from", e.target.value)} /></label>
        <label>To<input aria-label="To" type="date" value={filters.to} onChange={e => change("to", e.target.value)} /></label>
        <button className="qw-text-button" type="button" onClick={() => setFilters(initialHistoryFilters)}>Clear filters</button>
      </div>
      <p className="qw-micro" role="status">{invalidDates ? "Choose an end date on or after the start date." : `${trades.length} matching records. Dates use your local time; undated records are excluded when filtering by date.`}</p>
      <Positions variant="history" showActive={false} active={null} completed={trades} journal={state.journal ?? {}} onNote={onNote} disabled={disabled} onMonitor={() => {}} />
    </section>
  </div>;
}
