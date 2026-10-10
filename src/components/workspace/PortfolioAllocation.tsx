import { portfolioSummary, type DemoState } from "@/lib/demo-trading";
export default function PortfolioAllocation({state}: {state: DemoState}) {
 const summary=portfolioSummary(state), capital=summary.cash+summary.invested;
 return <section className="qw-card qw-allocation" aria-labelledby="allocation-title"><div className="qw-card-heading"><h2 id="allocation-title">Capital allocation</h2><span className="qw-badge">SIMULATED EUR</span></div><dl className="qx-portfolio-metrics"><div><dt>Available cash</dt><dd>{capital>0 ? `${(summary.cash/capital*100).toFixed(1)}%` : "—"}</dd></div><div><dt>{state.active ? `${state.active.asset} invested capital` : "Invested capital"}</dt><dd>{capital>0 ? `${(summary.invested/capital*100).toFixed(1)}%` : "—"}</dd></div></dl><p className="qw-micro">Allocation reflects cash and invested principal. Unrealized P&amp;L is shown separately; this is not historical market performance.</p></section>;
}
