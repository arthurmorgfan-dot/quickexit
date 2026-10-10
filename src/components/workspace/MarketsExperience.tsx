import { euro, portfolioSummary, signedEuro } from "@/lib/demo-trading";
import type usePersistentDemo from "./usePersistentDemo";
import AccountPanel from "./AccountPanel";

type Workspace = ReturnType<typeof usePersistentDemo>;
export default function MarketsExperience({ workspace: w, children, onTrade, onResults }: { workspace: Workspace; children: React.ReactNode; onTrade: () => void; onResults: () => void }) {
  const available = !w.checkingAuth && (!w.account || w.ready);
  const portfolio = available ? portfolioSummary(w.state) : null;
  const explore = () => { const search = document.querySelector<HTMLInputElement>('.qm-search input'); search?.scrollIntoView({ block: "center", behavior: "auto" }); search?.focus(); };
  return <div className="qx-markets-layout">
    <div className="qx-markets-content">
      <section className="qx-market-hero" aria-labelledby="markets-hero-title">
        <div className="qx-hero-copy"><span className="eyebrow">QUICKEXIT / PAPER TRADING</span><h2 id="markets-hero-title">Practice real decisions<br />in <span>real markets.</span></h2><p>Live market prices. Simulated money. A clear plan.</p><div className="qw-beta-actions"><button type="button" className="qm-trade" onClick={explore}>Explore Markets <span aria-hidden="true">↗</span></button><button type="button" className="qw-text-button" onClick={onResults}>Review your results</button></div></div>
        <div className="qx-orbit" aria-hidden="true"><div className="qx-globe" /><span>Real clarity.<br />Simulated money.</span></div>
      </section>
      <section className="qx-mobile-account" aria-label="Account and portfolio status"><span className="qw-badge">{w.checkingAuth ? "CHECKING ACCOUNT" : w.account ? "CLOUD · SIMULATED" : "DEMO · LOCAL"}</span><strong>{portfolio ? euro(portfolio.value) + " simulated value" : w.importAvailable ? "No cloud portfolio yet" : "Portfolio unavailable"}</strong>{w.account ? <details><summary>{w.importAvailable ? "Choose a starting portfolio" : "Account and synchronization"}</summary><AccountPanel workspace={w} /></details> : <button type="button" className="qw-text-button" onClick={onResults}>View portfolio →</button>}</section>
      {children}
    </div>
    <aside className="qx-markets-aside" aria-label="Portfolio and getting started">
      <section className="qw-card qx-portfolio" aria-labelledby="markets-portfolio-title"><div className="qw-card-heading"><h2 id="markets-portfolio-title">Your portfolio</h2><span className="qw-badge">{w.checkingAuth ? "CHECKING ACCOUNT" : w.account ? "CLOUD · SIMULATED" : "DEMO · LOCAL"}</span></div>
        <p role="status">{w.checkingAuth ? w.authError || "Restoring your session…" : w.account ? w.syncMessage || "Account paper workspace" : "Saved on this device. All funds are simulated."}</p>
        {portfolio ? <><span className="qx-value-label">Simulated portfolio value</span><strong className="qx-portfolio-value">{euro(portfolio.value)}</strong><dl className="qx-portfolio-metrics"><div><dt>Available cash</dt><dd>{euro(portfolio.cash)}</dd></div><div><dt>Allocated capital</dt><dd>{euro(portfolio.invested)}</dd></div><div><dt>Realized net P&amp;L</dt><dd>{signedEuro(portfolio.realized)}</dd></div><div><dt>Unrealized net P&amp;L</dt><dd>{signedEuro(portfolio.unrealized)}</dd></div></dl><p className="qw-micro">{w.state.active ? w.market?.mode === "demo" ? "Demo position valuation includes estimated exit costs. Prices and outcomes are simulated." : "Last observed position valuation, including estimated exit costs. Fresh quotes are required to trade." : "No active paper position. Realized results include trading costs."}</p><button type="button" className="qw-text-button" onClick={onResults}>View performance →</button></> : <div className="qx-uninitialized"><strong>{w.syncStatus === "import" ? "No cloud portfolio yet" : "Portfolio unavailable"}</strong><p>{w.syncStatus === "import" ? "Your account is signed in. Choose and confirm a starting portfolio before any simulated balance is created." : "Wait for account verification or resolve synchronization to see your balance."}</p></div>}
      </section>
      <section className="qw-card qx-start"><h2>{w.account && !available ? "Choose your starting point" : "A clearer next move"}</h2><ol className="qx-checklist"><li><span>1</span><div><strong>Explore markets</strong><p>BTC, ETH and SOL. Genuine EUR quotes.</p></div></li><li><span>2</span><div><strong>{w.account && !available ? "Choose a starting portfolio" : "Set your paper-trade plan"}</strong><p>{w.account && !available ? "Review before creating or importing anything." : "Choose an investment and net profit target."}</p></div></li><li><span>3</span><div><strong>Review your results</strong><p>Fixed receipts, net P&amp;L and journal notes.</p></div></li></ol>
        {w.account ? <details className="qx-account-details"><summary>{w.importAvailable ? "Choose a starting portfolio" : "Account and synchronization"}</summary><AccountPanel workspace={w} /></details> : <button type="button" className="qm-trade" disabled={!w.ready} onClick={onTrade}>Plan a paper trade →</button>}
      </section>
    </aside>
  </div>;
}
