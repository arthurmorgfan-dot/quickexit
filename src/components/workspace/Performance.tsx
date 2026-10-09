import { useEffect, useState } from "react";
import { euro, signedEuro, portfolioSummary, type DemoState } from "@/lib/demo-trading";
import { performanceStatistics, realizedHistory, filterHistory } from "@/lib/portfolio-performance";
export default function Performance({ state }: { state: DemoState }) {
  const [range, setRange] = useState<"ALL" | "1D" | "1W" | "1M">("ALL");
  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 60000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  const stats = performanceStatistics(state);
  const history = realizedHistory(state);
  const points = filterHistory(history, range, now);
  const low = Math.min(0, ...points.map(p => p.realized));
  const high = Math.max(0, ...points.map(p => p.realized));
  const first = points[0]?.time ?? 0, last = points.at(-1)?.time ?? first;
  const x = (time: number) => 20 + (last === first ? 0.5 : (time - first) / (last - first)) * 760;
  const y = (value: number) => 170 - (high === low ? 0.5 : (value - low) / (high - low)) * 140;
  const path = points.map((p, i) => `${i ? `H ${x(p.time)} V` : `M ${x(p.time)}`} ${y(p.realized)}`).join(" ");
  return <section className="qw-card qw-performance">
    <div className="qw-card-heading"><h2>Your performance</h2><span className="qw-badge">SIMULATED · NET OF COSTS</span></div>
    <dl className="qw-performance-metrics">{[
      ["Completed trades", stats.completed], ["Wins / losses / even", `${stats.wins} / ${stats.losses} / ${stats.breakeven}`],
      ["Win rate", stats.winRate === null ? "—" : `${stats.winRate.toFixed(1)}%`],
      ["Average realized net P&L", stats.average === null ? "—" : signedEuro(Math.round(stats.average))],
      ["Paid trading fees", euro(stats.fees)], ["Cumulative realized net P&L", signedEuro(stats.realized)],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="qw-card-heading"><h3>Realized performance over time</h3><div className="qw-options" aria-label="Performance time range">{(["ALL", "1D", "1W", "1M"] as const).map(r => <button type="button" key={r} aria-pressed={range === r} className={range === r ? "is-selected" : ""} onClick={() => setRange(r)}>{r === "ALL" ? "All" : r}</button>)}</div></div>
    {points.length ? <>
      <svg className="qw-performance-chart" viewBox="0 0 800 200" role="img" aria-label={`Cumulative realized net P&L from ${signedEuro(points[0].realized)} to ${signedEuro(points.at(-1)!.realized)} across ${points.length} recorded exit dates`}>
        <line x1="20" x2="780" y1={y(0)} y2={y(0)} stroke="#53665a" strokeDasharray="4 5" />
        <path d={path} stroke="#96edb9" strokeWidth="3" fill="none" />
        {points.map(p => <circle key={p.time} cx={x(p.time)} cy={y(p.realized)} r="4" fill="#96edb9"><title>{new Date(p.time).toLocaleString()} · {signedEuro(p.realized)}</title></circle>)}
      </svg>
      <div className="qw-chart-dates"><span>{new Date(first).toLocaleDateString()}</span><span>{new Date(last).toLocaleDateString()}</span></div>
      <details><summary>View recorded performance data</summary><ul>{points.map(p => <li key={p.time}>{new Date(p.time).toLocaleString()} · {signedEuro(p.realized)}</li>)}</ul></details>
    </> : <div className="qw-empty"><span>{history.length ? "No completed trades in this range." : "Your history starts with your first completed trade."}</span><p>Recorded paper exits will appear here. No historical portfolio values are estimated.</p></div>}
    <p className="qw-micro">The line changes only at recorded exits. Current unrealized net P&L: {signedEuro(portfolioSummary(state).unrealized)} — separate from this history. Transfers reduce available portfolio value, not trading performance. Paid fees exclude estimated exit fees on open positions.</p>
    {!!stats.legacy && <p className="qw-micro">{stats.legacy} legacy trades included in totals; dates and fees were not recorded. Their net P&L is carried into dated totals.</p>}
  </section>;
}
