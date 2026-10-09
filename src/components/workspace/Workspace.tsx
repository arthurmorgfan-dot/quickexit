"use client";
import { PAPER_COSTS, basisPercent } from "@/lib/paper-execution";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  House,
  ChartNoAxesCombined,
  Layers,
  List,
  Landmark,
  Settings,
  FlaskConical,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import Brand from "@/components/ui/Brand";
import {
  ASSETS,
  euro,
  signedEuro,
  currentPrice,
  portfolioSummary,
  type View,
} from "@/lib/demo-trading";
import { freshQuote } from "@/lib/market-data";
import { ActionButton, Switch } from "./Controls";
import MarketCard from "./MarketCard";
import TradeForm from "./TradeForm";
import { ActivePosition, ClosedPosition } from "./PositionCard";
import ActivityList from "./ActivityList";
import CashOut from "./CashOut";
import Positions from "./Positions";
import MobileDisclosure from "./MobileDisclosure";
import usePersistentDemo from "./usePersistentDemo";
import Markets from "./Markets";
import Performance from "./Performance";
import AccountPanel from "./AccountPanel";
const navigation = [
  { name: "Markets", icon: House },
  { name: "Home", icon: House },
  { name: "Trade", icon: ChartNoAxesCombined },
  { name: "Positions", icon: Layers },
  { name: "Activity", icon: List },
  { name: "Cash Out", icon: Landmark },
  { name: "Settings", icon: Settings },
] as const;
const descriptions: Record<View, string> = {
  Markets: "Real cryptocurrencies. Your next paper trade.",
  Home: "A clear view of your next move.",
  Trade: "Enter with a plan. Leave with a purpose.",
  Positions: "Your money, from entry to exit.",
  Activity: "Every move, in plain language.",
  "Cash Out": "Your money’s next destination: home.",
  Settings: "A demo that moves at your pace.",
};
export default function Workspace() {
  const workspace = usePersistentDemo();
  const {
    state,
    asset,
    dispatch,
    setAsset,
    resetDemo,
    hydrated,
    storageStatus,
    recovered,
    market,
    marketStatus,
    setMarketMode,
    account,
    syncStatus,
    ready,
    checkingAuth,
  } = workspace;
  const portfolio = portfolioSummary(state);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 5000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  const [view, setView] = useState<View>("Markets"),
    [confirmReset, setConfirmReset] = useState(false);
  const saveLabel = checkingAuth
    ? "Checking account…"
    : account
      ? syncStatus === "saved"
        ? "Saved to your account"
        : syncStatus === "syncing"
          ? "Syncing…"
          : syncStatus === "reauth"
            ? "Session ended · sign in to sync"
            : syncStatus === "loading"
              ? "Restoring account…"
              : syncStatus === "conflict"
                ? "Sync needs your choice"
                : syncStatus === "import"
                  ? "Choose your starting state"
                  : storageStatus === "unavailable"
                    ? "Not saved · cloud sync paused"
                    : "Cloud sync paused · device copy kept"
      : storageStatus === "loading"
        ? "Restoring demo…"
        : storageStatus === "saved"
          ? "Saved on this device"
          : "Not saved on this device";
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navigate = (next: View) => {
    setView(next);
    setConfirmReset(false);
    window.requestAnimationFrame(() => {
      titleRef.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 700px)").matches)
        window.scrollTo({ top: 0, behavior: "instant" });
    });
  };
  const cancelReset = () => {
    setConfirmReset(false);
    window.requestAnimationFrame(() =>
      document.getElementById("reset-demo-button")?.focus(),
    );
  };
  const newTrade = () => {
    dispatch({ type: "NEW_TRADE" });
    navigate("Trade");
  };
  useEffect(() => {
    if (!hydrated) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pause = () => {
      if (reduced.matches) dispatch({ type: "PLAY", value: false });
    };
    reduced.addEventListener("change", pause);
    return () => reduced.removeEventListener("change", pause);
  }, [hydrated, dispatch]);
  const activeId = state.active?.id;
  const previousActiveId = useRef(activeId);
  useEffect(() => {
    if (previousActiveId.current === activeId) return;
    previousActiveId.current = activeId;
    if (view !== "Trade") return;
    const destination = document.getElementById(
      activeId === undefined ? "closed-title" : "active-title",
    );
    if (destination) {
      destination.tabIndex = -1;
      destination.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 700px)").matches) {
        destination
          .closest("section")
          ?.scrollIntoView({ block: "start", behavior: "instant" });
      }
    }
  }, [activeId, view]);
  useEffect(() => {
    if (
      !hydrated ||
      !ready ||
      market.mode === "live" ||
      activeId === undefined ||
      !state.playing
    )
      return;
    const interval = window.setInterval(
      () => dispatch({ type: "MOVE", mode: "tick", positionId: activeId }),
      4000,
    );
    return () => window.clearInterval(interval);
  }, [activeId, state.playing, hydrated, dispatch, market.mode, ready]);
  const selectedAsset = state.active?.asset ?? asset;
  const live = market.mode === "live";
  const quote = market.quotes[selectedAsset];
  const usableQuote = !!quote && now > 0 && freshQuote(quote, now);
  const marketLabel = live ? "Live market prices" : "Demo prices";
  const marketMessage = !live
    ? "Deterministic demo controls enabled."
    : marketStatus === "loading"
      ? quote
        ? "Connecting… Last known prices stay in place."
        : "Connecting… Demo reference price shown until a live quote arrives."
      : marketStatus === "connected" && usableQuote
        ? "Connected · Coinbase · updates every 30 seconds."
        : quote
          ? "Prices unavailable or stale. Last known values are held; live updates are paused. Switch to Demo to try an outcome."
          : "Prices unavailable. Demo reference price shown; live updates and new trades are paused. Switch to Demo to try an outcome.";
  const realised = portfolio.realized;
  return (
    <div
      className="qe-workspace"
      aria-busy={!hydrated}
      inert={!hydrated}
      data-trade-state={
        state.active ? "active" : state.lastClosed ? "closed" : "new"
      }
    >
      <a className="skip-link" href="#workspace-main">
        Skip to workspace
      </a>
      <aside className="qw-sidebar">
        <Brand href="/" />
        <div className="qw-sidebar-label">YOUR WORKSPACE</div>
        <nav aria-label="Workspace navigation" id="workspace-navigation">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              type="button"
              key={name}
              aria-current={view === name ? "page" : undefined}
              className={view === name ? "is-active" : ""}
              onClick={() => navigate(name)}
            >
              <Icon size={17} />
              <span>{name}</span>
              {name === "Positions" && state.active && (
                <span className="qw-nav-count">1</span>
              )}
            </button>
          ))}
        </nav>
        <div className="qw-sidebar-bottom">
          <div className="qw-demo-label">
            <FlaskConical size={16} />
            <div>
              <strong>{account ? "Paper workspace" : "Demo workspace"}</strong>
              <span>Real clarity. Simulated money.</span>
            </div>
          </div>
          <p>
            {saveLabel}
            <br />
            Simulated funds only.
          </p>
          <Link href="/">
            Back to QuickExit <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
      <div className="qw-app">
        <header className="qw-topbar">
          <div>
            <span>
              Workspace <span className="qw-breadcrumb">/</span>
              <strong>{view}</strong>
            </span>
          </div>
          <div className="qw-topbar-right">
            <span className="qw-badge">
              <span className="status-dot" /> PROTOTYPE
            </span>
            <button
              type="button"
              className="qw-mobile-home"
              aria-label="Workspace Home"
              aria-current={view === "Home" ? "page" : undefined}
              onClick={() => navigate("Home")}
            >
              <House size={19} />
            </button>
            {account ? (
              <button
                type="button"
                className="qw-account-link"
                onClick={() => navigate("Settings")}
                aria-label={`Account settings for ${account.email}`}
              >
                <span className="qw-account-desktop">{account.email}</span>
                <span className="qw-account-mobile">Account</span>
              </button>
            ) : (
              <Link href="/signin" className="qw-account-link">
                Sign in
              </Link>
            )}
            <button type="button" className="qw-text-button" aria-label="Workspace settings" onClick={() => navigate("Settings")}><Settings size={18} /></button>
            <span
              className="qw-avatar"
              aria-label={account ? "Paper account" : "Demo profile"}
            >
              {account ? account.email.slice(0, 1).toUpperCase() : "D"}
            </span>
          </div>
        </header>
        <main id="workspace-main" className="qw-main" tabIndex={-1}>
          <div className="qw-page-heading">
            <div>
              <span className="qw-overline">
                QUICKEXIT / {view.toUpperCase()}
              </span>
              <h1 tabIndex={-1} ref={titleRef}>
                {view === "Trade"
                  ? state.active
                    ? "A clear view of your profit."
                    : state.lastClosed
                      ? "A good trade has an ending."
                      : "Make your next move."
                  : view === "Home"
                    ? "Welcome to a clearer way out."
                    : view === "Cash Out"
                      ? "Send it home."
                      : view === "Positions"
                        ? "Every trade has a purpose."
                        : view === "Markets"
                          ? "Find your next move."
                        : view === "Activity"
                          ? "Your story, trade by trade."
                          : "Keep it simple."}
              </h1>
              <p>{descriptions[view]}</p>
            </div>
            <div className="qw-heading-balance">
              <span>Available cash</span>
              <strong>{euro(state.cash)}</strong>
              <button type="button" onClick={() => navigate("Cash Out")}>
                Send it home <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
          <div className="qw-prototype-notice">
            <FlaskConical size={15} />
            <p>
              You’re in the demo. All trades and transfers are simulated. No
              real funds are used. New demos start with €10,000 virtual EUR.
            </p>
          </div>
          <p className="qw-market-status" role="status">
            {view === "Markets" ? "Real market prices · your trading balances and executions remain simulated." : <><strong>{marketLabel}</strong> · {marketMessage}</>}
          </p>
          {(view === "Trade" || view === "Home") && (
            <section
              className="qw-overview-stats qw-portfolio-stats"
              aria-label="Simulated portfolio"
            >
              {[
                ["Available virtual cash", euro(portfolio.cash)],
                ["Invested", euro(portfolio.invested)],
                ["Portfolio value", euro(portfolio.value)],
                ["Realized net P&L", signedEuro(portfolio.realized)],
                ["Unrealized net P&L", signedEuro(portfolio.unrealized)],
                ["Transferred out", euro(state.sent)],
              ].map(([label, value]) => (
                <div className="qw-card qw-stat" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>
                    {label === "Unrealized net P&L"
                      ? !state.active ? "No active position" : live ? usableQuote ? "Fresh market valuation · estimated exit costs" : "Last observed valuation · quote unavailable or stale" : "Demo valuation · estimated exit costs"
                      : label === "Realized net P&L" ? "Completed paper trades · after costs"
                      : label === "Transferred out" ? "Simulated transfers · excluded from portfolio value"
                      : label === "Portfolio value"
                        ? "Estimated after trading costs"
                        : "Simulated EUR"}
                  </small>
                </div>
              ))}
            </section>
          )}
          {state.portfolioCapital === undefined && (
            <p className="qw-market-status">
              Your existing demo balance is preserved. Reset Demo in Settings
              starts a fresh €10,000 portfolio.
            </p>
          )}
          <AccountPanel workspace={workspace} compact />
          {view === "Markets" && <Markets activeAsset={state.active?.asset ?? null} disabled={!ready} onSelect={next => { setAsset(next); if (!state.active) { dispatch({ type: "NEW_TRADE" }); setMarketMode("live"); } navigate("Trade"); }} />}
          {view === "Trade" && (
            <>
              <div className="qw-paper-controls" inert={!ready}>
                <div className="qw-trade-layout">
                  <MobileDisclosure
                    label="Market overview"
                    hint={`${selectedAsset} · ${marketLabel}`}
                    className="qw-market-disclosure"
                    enabled={!!state.active || !!state.lastClosed}
                  >
                    <div className="qw-market-column">
                      <MarketCard
                        asset={selectedAsset}
                        setAsset={setAsset}
                        locked={!!state.active}
                        live={live}
                        quote={quote}
                        connection={marketStatus}
                        price={
                          live && quote
                            ? quote.price
                            : state.active
                              ? currentPrice(state.active)
                              : ASSETS[selectedAsset].price
                        }
                      />
                      <div className="qw-plan-card">
                        <span className="qw-overline">
                          THE WAY OUT IS THE POINT.
                        </span>
                        <h2>
                          Trade it. Profit.
                          <br />
                          <span>Send it home.</span>
                        </h2>
                        <div className="qw-plan-steps">
                          <span
                            className={
                              state.active || state.lastClosed ? "is-done" : ""
                            }
                          >
                            01 <strong>Choose your trade</strong>
                          </span>
                          <ArrowRight size={13} />
                          <span className={state.lastClosed ? "is-done" : ""}>
                            02 <strong>Reach your exit</strong>
                          </span>
                          <ArrowRight size={13} />
                          <span>
                            03 <strong>Send it home</strong>
                          </span>
                        </div>
                        <p>
                          Money enters for a trade. When the trade ends, the
                          money leaves.
                        </p>
                      </div>
                    </div>
                  </MobileDisclosure>
                  {state.active ? (
                    <ActivePosition
                      key={state.active.id}
                      position={state.active}
                      dispatch={dispatch}
                      playing={state.playing}
                      live={live}
                    />
                  ) : state.lastClosed ? (
                    <ClosedPosition
                      position={state.lastClosed}
                      cash={state.cash}
                      onCashOut={() => navigate("Cash Out")}
                      onNewTrade={newTrade}
                    />
                  ) : (
                    <TradeForm
                      key={`${account?.id ?? "guest"}-${asset}-${market.mode}`}
                      live={live}
                      availableCash={state.cash}
                      notice={state.announcement}
                      asset={asset}
                      dispatch={dispatch}
                      disabled={live && !usableQuote}
                      price={live && quote ? quote.price : ASSETS[asset].price}
                    />
                  )}
                </div>
              </div>
              <section className="qw-card qw-recent">
                <div className="qw-card-heading">
                  <h2>Recent activity</h2>
                  <button
                    type="button"
                    className="qw-text-button"
                    onClick={() => navigate("Activity")}
                  >
                    View all <ArrowUpRight size={13} />
                  </button>
                </div>
                <ActivityList events={state.events} compact />
              </section>
            </>
          )}
          {view === "Home" && (
            <>
              <Performance state={state} />
              <p className="qw-market-status">{live ? quote ? `Selected market quote: ${new Date(quote.updatedAt).toLocaleString()} · ${usableQuote && marketStatus === "connected" ? "Fresh" : "Stale or unavailable — last observed valuation"}` : "Waiting for a verified market quote." : "Demo valuation · deterministic simulated prices"}</p>
              <section className="qw-card qw-home-next">
                <div>
                  <span className="qw-overline">YOUR NEXT MOVE</span>
                  <h2>
                    {state.active
                      ? "Your target is doing the work."
                      : state.lastClosed && state.cash > 0
                        ? "Your trade is done. Send it home."
                        : "One trade. One clear exit."}
                  </h2>
                  <p>
                    {state.active
                      ? `${state.active.asset} position · ${signedEuro(state.active.profit)} profit · ${signedEuro(state.active.target)} target`
                      : state.lastClosed && state.cash > 0
                        ? `${euro(state.cash)} of simulated cash is ready to leave the platform.`
                        : "Explore markets and put your virtual EUR to work. All trades are simulated."}
                  </p>
                </div>
                <ActionButton
                  onClick={() =>
                    navigate(
                      state.active
                        ? "Trade"
                        : state.lastClosed && state.cash > 0
                          ? "Cash Out"
                          : "Markets",
                    )
                  }
                >
                  {state.active
                    ? "Monitor trade"
                    : state.lastClosed && state.cash > 0
                      ? "Send to Bank"
                      : "Plan a trade"}
                </ActionButton>
              </section>
              <div className="qw-card qw-recent">
                <div className="qw-card-heading">
                  <h2>Recent activity</h2>
                  <span className="qw-overline">THIS DEMO</span>
                </div>
                <ActivityList events={state.events} compact />
              </div>
            </>
          )}
          {view === "Positions" && (
            <Positions
              active={state.active}
              completed={state.completed}
              journal={state.journal ?? {}}
              onNote={(tradeId, note) => dispatch({ type: "JOURNAL", tradeId, note })}
              disabled={!ready}
              onMonitor={() => navigate("Trade")}
            />
          )}
          {view === "Activity" && (
            <section className="qw-card qw-full-activity">
              <div className="qw-card-heading">
                <h2>Your activity</h2>
                <span className="qw-overline">
                  {state.events.length} EVENTS · DEMO SESSION
                </span>
              </div>
              <ActivityList events={state.events} />
            </section>
          )}
          {view === "Cash Out" && (
            <div className="qw-paper-controls" inert={!ready}>
              <CashOut
                cash={state.cash}
                lastTransfer={state.lastTransfer}
                sent={state.sent}
                onTransfer={() =>
                  dispatch({
                    type: "TRANSFER",
                    expectedSequence: state.sequence,
                  })
                }
                onTrade={newTrade}
              />
            </div>
          )}{" "}
          {view === "Settings" && (
            <div className="qw-settings-layout">
              <section className="qw-card qw-settings">
                <div className="qw-card-heading">
                  <h2>{account ? "Paper preferences" : "Demo preferences"}</h2>
                  <span className="qw-badge">
                    {account ? "CLOUD SYNC" : "LOCAL ONLY"}
                  </span>
                </div>
                <AccountPanel workspace={workspace} />
                <div className="qw-paper-controls" inert={!ready}>
                  <div className="qw-setting-info">
                    <span id="market-data-label">Market data</span>
                    <div
                      className="qw-options"
                      role="group"
                      aria-labelledby="market-data-label"
                    >
                      {(["live", "demo"] as const).map((mode) => (
                        <button
                          type="button"
                          key={mode}
                          aria-pressed={market.mode === mode}
                          className={market.mode === mode ? "is-selected" : ""}
                          onClick={() => setMarketMode(mode)}
                        >
                          {mode === "live" ? "Live" : "Demo"}
                        </button>
                      ))}
                    </div>
                    <p>
                      Live uses public EUR market quotes from Coinbase. Demo
                      enables predictable outcomes. Switching keeps your entry
                      price fixed; returning to Live may trigger a paper exit at
                      the next market update. Market charts show verified exchange history only. No
                      real trades or funds.
                    </p>
                  </div>
                  {!live && (
                    <Switch
                      label="Subtle price movement"
                      description="Active positions move slightly every four seconds. Reduced-motion preferences pause this by default."
                      checked={state.playing}
                      onChange={(value) => dispatch({ type: "PLAY", value })}
                    />
                  )}
                  <div className="qw-setting-info">
                    <span>Device storage</span>
                    <strong role="status">{saveLabel}</strong>
                    <p>
                      {storageStatus === "unavailable"
                        ? "Device storage is unavailable. Changes and resets may not survive refresh; you can still use the temporary demo."
                        : account
                          ? "Paper state is cached on this device and synced to your account. No real funds or banking details."
                          : "Demo paper state stays in this browser. Sign in to save across devices."}
                    </p>
                    {recovered && (
                      <p role="status">
                        The previous saved demo could not be restored. A clean
                        paper-trading demo is ready.
                      </p>
                    )}
                  </div>
                  <div className="qw-setting-info">
                    <span>Paper trading assumptions</span>
                    <strong>
                      Entry fee {basisPercent(PAPER_COSTS.entryFeeBps)} · Exit
                      fee {basisPercent(PAPER_COSTS.exitFeeBps)}
                    </strong>
                    <p>
                      Spread {basisPercent(PAPER_COSTS.spreadBps)} (half per
                      side) · Slippage {basisPercent(PAPER_COSTS.slippageBps)}{" "}
                      per side. Investment includes the entry fee. Targets and
                      percentage returns are net of estimated costs. Each trade
                      keeps its opening assumptions. Actual exchange execution
                      can differ.
                    </p>
                  </div>
                  <div className="qw-setting-info">
                    <span>Currency</span>
                    <strong>Euro · EUR</strong>
                    <p>Clear outcomes, in money you understand.</p>
                  </div>
                  <div className="qw-setting-info">
                    <span>Demo bank account</span>
                    <strong>•••• 4821</strong>
                    <p>A placeholder only. There is no bank connection.</p>
                  </div>
                  <div className="qw-setting-info">
                    <span>Realised demo profit / loss</span>
                    <strong
                      className={realised >= 0 ? "qw-positive" : "qw-negative"}
                    >
                      {signedEuro(realised)}
                    </strong>
                    <p>Excludes the illustrative example history.</p>
                  </div>
                  <div className="qw-reset">
                    <h3>Start with a clean slate</h3>
                    <p>
                      Clear saved positions, activity, preferences, and
                      simulated balances{" "}
                      {account
                        ? "in this account, across synced devices"
                        : "on this device"}
                      .
                    </p>
                    {confirmReset ? (
                      <div
                        id="reset-demo-confirmation"
                        className="qw-reset-confirmation"
                        onKeyDown={(event) => {
                          if (event.key === "Escape") cancelReset();
                        }}
                        role="group"
                        aria-labelledby="reset-confirmation-label"
                      >
                        <p id="reset-confirmation-label">
                          Reset{" "}
                          {account
                            ? "this account’s paper workspace"
                            : "this device’s demo"}
                          ? Your saved trades, activity, and simulated balances
                          will be cleared and virtual cash restored to €10,000.
                          This cannot be undone.
                        </p>
                        <ActionButton
                          onClick={() => {
                            resetDemo();
                            cancelReset();
                          }}
                        >
                          Reset Demo
                        </ActionButton>
                        <button
                          type="button"
                          id="keep-demo-button"
                          className="qw-text-button"
                          onClick={cancelReset}
                        >
                          Keep this demo
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id="reset-demo-button"
                        className="qw-reset-button"
                        onClick={() => {
                          setConfirmReset(true);
                          window.requestAnimationFrame(() =>
                            document
                              .getElementById("keep-demo-button")
                              ?.focus(),
                          );
                        }}
                      >
                        <RotateCcw size={14} /> Reset Demo
                      </button>
                    )}
                  </div>
                </div>
              </section>
              <aside className="qw-settings-note">
                <ShieldCheck size={24} />
                <h2>
                  A prototype.
                  <br />
                  With clear boundaries.
                </h2>
                <p>
                  No real deposits. No bank details. All trades and transfers
                  are simulated. Accounts optionally sync paper state across
                  devices; Try Demo stays local. Live mode only reads public
                  market prices. Reset Demo clears the current paper workspace.
                </p>
                <p>
                  Targets and downside protection in a future live product would
                  be subject to market movement, fees, liquidity, and partner
                  availability. Returns and maximum losses are not guaranteed.
                </p>
                <Link href="/#security" className="qw-text-button">
                  Our approach to trust <ArrowUpRight size={14} />
                </Link>
              </aside>
            </div>
          )}
          <footer className="qw-workspace-footer">
            <span>
              QuickExit · Interactive prototype
              <small className="qw-save-status" role="status">
                {saveLabel}
              </small>
            </span>
            <p>
              Crypto involves financial risk. Capital is at risk; profits are
              not guaranteed. No live trading, custody, payments, or licensed
              partner integrations.
            </p>
          </footer>
        </main>
      </div>
      <nav className="qw-bottom-nav" aria-label="Mobile workspace navigation">
        {navigation
          .filter((item) => item.name !== "Activity" && item.name !== "Settings")
          .map(({ name, icon: Icon }) => (
            <button
              type="button"
              key={name}
              aria-current={view === name ? "page" : undefined}
              className={view === name ? "is-active" : ""}
              onClick={() => navigate(name)}
            >
              <span className="qw-bottom-icon">
                <Icon size={21} aria-hidden="true" />
                {name === "Positions" && state.active && (
                  <span className="qw-bottom-dot" />
                )}
                {name === "Cash Out" && state.cash > 0 && (
                  <span className="qw-bottom-dot" />
                )}
              </span>
              <span>{name === "Cash Out" ? "Cash Out" : name}</span>
            </button>
          ))}
      </nav>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state.announcement}
      </div>
    </div>
  );
}
