"use client";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
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
  X,
  Menu,
  RotateCcw,
} from "lucide-react";
import Brand from "@/components/ui/Brand";
import {
  ASSETS,
  demoReducer,
  initialDemo,
  euro,
  signedEuro,
  currentPrice,
  type Asset,
  type View,
} from "@/lib/demo-trading";
import { ActionButton, Switch } from "./Controls";
import MarketCard from "./MarketCard";
import TradeForm from "./TradeForm";
import { ActivePosition, ClosedPosition } from "./PositionCard";
import ActivityList from "./ActivityList";
import CashOut from "./CashOut";
import Positions from "./Positions";
const navigation = [
  { name: "Home", icon: House },
  { name: "Trade", icon: ChartNoAxesCombined },
  { name: "Positions", icon: Layers },
  { name: "Activity", icon: List },
  { name: "Cash Out", icon: Landmark },
  { name: "Settings", icon: Settings },
] as const;
const descriptions: Record<View, string> = {
  Home: "A clear view of your next move.",
  Trade: "Enter with a plan. Leave with a purpose.",
  Positions: "Your money, from entry to exit.",
  Activity: "Every move, in plain language.",
  "Cash Out": "Your money’s next destination: home.",
  Settings: "A demo that moves at your pace.",
};
export default function Workspace() {
  const [state, dispatch] = useReducer(demoReducer, undefined, initialDemo),
    [view, setView] = useState<View>("Trade"),
    [asset, setAsset] = useState<Asset>("BTC"),
    [mobileMenu, setMobileMenu] = useState(false),
    [confirmReset, setConfirmReset] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null),
    menuRef = useRef<HTMLButtonElement>(null);
  const navigate = (next: View) => {
    setView(next);
    setMobileMenu(false);
    setConfirmReset(false);
    window.requestAnimationFrame(() =>
      titleRef.current?.focus({ preventScroll: true }),
    );
  };
  const newTrade = () => {
    dispatch({ type: "NEW_TRADE" });
    navigate("Trade");
  };
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pause = () => {
      if (reduced.matches) dispatch({ type: "PLAY", value: false });
    };
    pause();
    reduced.addEventListener("change", pause);
    return () => reduced.removeEventListener("change", pause);
  }, []);
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
    }
  }, [activeId, view]);
  useEffect(() => {
    if (activeId === undefined || !state.playing) return;
    const interval = window.setInterval(
      () => dispatch({ type: "MOVE", mode: "tick" }),
      4000,
    );
    return () => window.clearInterval(interval);
  }, [activeId, state.playing]);
  useEffect(() => {
    if (!mobileMenu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenu(false);
        menuRef.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileMenu]);
  const selectedAsset = state.active?.asset ?? asset;
  const realised = state.completed
    .filter((p) => !p.example)
    .reduce((sum, p) => sum + p.profit, 0);
  return (
    <div className="qe-workspace">
      <a className="skip-link" href="#workspace-main">
        Skip to workspace
      </a>
      <aside className="qw-sidebar">
        <Brand href="/" />
        <div className="qw-sidebar-label">YOUR WORKSPACE</div>
        <nav
          aria-label="Workspace navigation"
          id="workspace-navigation"
          className={mobileMenu ? "is-open" : ""}
        >
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
              <strong>Demo workspace</strong>
              <span>Real clarity. Simulated money.</span>
            </div>
          </div>
          <p>
            Local state only.
            <br />
            Refresh to start fresh.
          </p>
          <Link href="/">
            Back to QuickExit <ArrowUpRight size={14} />
          </Link>
        </div>
      </aside>
      <div className="qw-app">
        <header className="qw-topbar">
          <div>
            <button
              ref={menuRef}
              type="button"
              className="qw-menu"
              aria-label={
                mobileMenu
                  ? "Close workspace navigation"
                  : "Open workspace navigation"
              }
              aria-expanded={mobileMenu}
              aria-controls="workspace-navigation"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X size={21} /> : <Menu size={21} />}
            </button>
            <span>
              Workspace <span className="qw-breadcrumb">/</span>
              <strong>{view}</strong>
            </span>
          </div>
          <div className="qw-topbar-right">
            <span className="qw-badge">
              <span className="status-dot" /> PROTOTYPE
            </span>
            <span className="qw-avatar" aria-label="Demo profile">
              D
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
              You’re in the demo. All prices, trades, and transfers are
              simulated. No real funds are used.
            </p>
          </div>
          {view === "Trade" && (
            <>
              <div className="qw-trade-layout">
                <div className="qw-market-column">
                  <MarketCard
                    asset={selectedAsset}
                    setAsset={setAsset}
                    locked={!!state.active}
                    price={
                      state.active
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
                      Money enters for a trade. When the trade ends, the money
                      leaves.
                    </p>
                  </div>
                </div>
                {state.active ? (
                  <ActivePosition
                    key={state.active.id}
                    position={state.active}
                    dispatch={dispatch}
                    playing={state.playing}
                  />
                ) : state.lastClosed ? (
                  <ClosedPosition
                    position={state.lastClosed}
                    cash={state.cash}
                    onCashOut={() => navigate("Cash Out")}
                    onNewTrade={newTrade}
                  />
                ) : (
                  <TradeForm asset={asset} dispatch={dispatch} />
                )}
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
              <div className="qw-overview-stats">
                {[
                  {
                    label: "In your active trade",
                    value: euro(state.active?.amount ?? 0),
                    note: state.active
                      ? `${state.active.asset} · one purposeful trade`
                      : "No idle investment balance",
                  },
                  {
                    label: "Current profit",
                    value: signedEuro(state.active?.profit ?? 0),
                    note: state.active
                      ? "Your active position"
                      : "No open position",
                  },
                  {
                    label: "Sent home",
                    value: euro(state.sent),
                    note: "Simulated proceeds, back home",
                  },
                ].map((item) => (
                  <div className="qw-card qw-stat" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.note}</small>
                  </div>
                ))}
              </div>
              <section className="qw-card qw-home-next">
                <div>
                  <span className="qw-overline">YOUR NEXT MOVE</span>
                  <h2>
                    {state.active
                      ? "Your target is doing the work."
                      : state.cash > 0
                        ? "Your trade is done. Send it home."
                        : "One trade. One clear exit."}
                  </h2>
                  <p>
                    {state.active
                      ? `${state.active.asset} position · ${signedEuro(state.active.profit)} profit · ${signedEuro(state.active.target)} target`
                      : state.cash > 0
                        ? `${euro(state.cash)} of simulated cash is ready to leave the platform.`
                        : "Choose an asset, an amount, and what you want to make."}
                  </p>
                </div>
                <ActionButton
                  onClick={() =>
                    navigate(
                      state.cash > 0 && !state.active ? "Cash Out" : "Trade",
                    )
                  }
                >
                  {state.active
                    ? "Monitor trade"
                    : state.cash > 0
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
            <CashOut
              cash={state.cash}
              lastTransfer={state.lastTransfer}
              sent={state.sent}
              onTransfer={() => dispatch({ type: "TRANSFER" })}
              onTrade={newTrade}
            />
          )}{" "}
          {view === "Settings" && (
            <div className="qw-settings-layout">
              <section className="qw-card qw-settings">
                <div className="qw-card-heading">
                  <h2>Demo preferences</h2>
                  <span className="qw-badge">LOCAL ONLY</span>
                </div>
                <Switch
                  label="Subtle price movement"
                  description="Active positions move slightly every four seconds. Reduced-motion preferences pause this by default."
                  checked={state.playing}
                  onChange={(value) => dispatch({ type: "PLAY", value })}
                />
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
                    Clear this session’s positions, activity, and simulated
                    balances.
                  </p>
                  {confirmReset ? (
                    <div>
                      <ActionButton
                        onClick={() => {
                          dispatch({ type: "RESET" });
                          setConfirmReset(false);
                          setAsset("BTC");
                        }}
                      >
                        Reset demo
                      </ActionButton>
                      <button
                        type="button"
                        className="qw-text-button"
                        onClick={() => setConfirmReset(false)}
                      >
                        Keep this session
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="qw-reset-button"
                      onClick={() => setConfirmReset(true)}
                    >
                      <RotateCcw size={14} /> Reset demo session
                    </button>
                  )}
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
                  No accounts. No deposits. No bank details. Everything happens
                  in this browser’s memory, and resets when you refresh.
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
            <span>QuickExit · Interactive prototype</span>
            <p>
              Crypto involves financial risk. Capital is at risk; profits are
              not guaranteed. No live trading, custody, payments, or licensed
              partner integrations.
            </p>
          </footer>
        </main>
      </div>
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
