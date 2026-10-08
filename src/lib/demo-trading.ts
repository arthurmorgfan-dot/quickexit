/** Client-only simulation. Integer cents keep mock balances and cash-out consistent. */
export const ASSETS = {
  BTC: { name: "Bitcoin", price: 63421.2, change: 1.24, symbol: "₿" },
  ETH: { name: "Ethereum", price: 2486.75, change: 0.86, symbol: "Ξ" },
  SOL: { name: "Solana", price: 148.32, change: -0.42, symbol: "◎" },
} as const;
export type Asset = keyof typeof ASSETS;
export type View =
  "Home" | "Trade" | "Positions" | "Activity" | "Cash Out" | "Settings";
export type ExitReason = "target" | "protection" | "manual";
export type Position = {
  id: number;
  asset: Asset;
  amount: number;
  target: number;
  protection: number | null;
  autoExit: boolean;
  entryPrice: number;
  profit: number;
  status: "active" | "closed";
  reason?: ExitReason;
  example?: boolean;
  /** Observed market price at a paper exit; never an execution price. */
  exitPrice?: number;
};
export type ActivityEvent = {
  id: number;
  text: string;
  kind: "buy" | "target" | "sell" | "bank" | "info";
};
export type DemoState = {
  active: Position | null;
  completed: Position[];
  cash: number;
  sent: number;
  lastClosed: Position | null;
  lastTransfer: number;
  events: ActivityEvent[];
  sequence: number;
  tick: number;
  playing: boolean;
  announcement: string;
};
export const euro = (cents: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export const signedEuro = (cents: number) =>
  `${cents >= 0 ? "+" : "−"}${euro(Math.abs(cents))}`;
export const priceEuro = (price: number) => euro(Math.round(price * 100));
export const currentPrice = (p: Position) =>
  p.entryPrice * (1 + p.profit / p.amount);
export const profitPercent = (p: Position) =>
  ((p.profit / p.amount) * 100).toFixed(2);
export const progress = (p: Position) =>
  Math.max(0, Math.min(100, Math.floor((p.profit / p.target) * 100)));
export const reasonLabel = (p: Position) =>
  p.reason === "target"
    ? "Target reached"
    : p.reason === "protection"
      ? "Protection exit"
      : "Sold manually";
const examples: Position[] = [
  {
    id: -1,
    asset: "BTC",
    amount: 10000,
    target: 500,
    protection: 200,
    autoExit: true,
    entryPrice: 62140,
    profit: 500,
    status: "closed",
    reason: "target",
    example: true,
  },
  {
    id: -2,
    asset: "ETH",
    amount: 25000,
    target: 1000,
    protection: 200,
    autoExit: true,
    entryPrice: 2441.8,
    profit: -200,
    status: "closed",
    reason: "protection",
    example: true,
  },
  {
    id: -3,
    asset: "SOL",
    amount: 5000,
    target: 250,
    protection: null,
    autoExit: false,
    entryPrice: 145.65,
    profit: 182,
    status: "closed",
    reason: "manual",
    example: true,
  },
];
export function initialDemo(): DemoState {
  return {
    active: null,
    completed: examples,
    cash: 0,
    sent: 0,
    lastClosed: null,
    lastTransfer: 0,
    events: [
      {
        id: 0,
        text: "Your demo is ready. Start with one trade.",
        kind: "info",
      },
    ],
    sequence: 1,
    tick: 0,
    playing: true,
    announcement: "",
  };
}
export type DemoAction =
  | {
      type: "BUY";
      asset: Asset;
      amount: number;
      target: number;
      protection: number | null;
      autoExit: boolean;
      entryPrice?: number;
    }
  | { type: "MOVE"; mode: "rise" | "fall" | "target" | "tick" }
  | { type: "MARKET_PRICE"; price: number }
  | { type: "SELL" }
  | { type: "EDIT_TARGET"; target: number; live?: boolean }
  | { type: "TRANSFER" }
  | { type: "PLAY"; value: boolean }
  | { type: "NEW_TRADE" }
  | { type: "RESET" };
function event(
  state: DemoState,
  text: string,
  kind: ActivityEvent["kind"],
): DemoState {
  return {
    ...state,
    sequence: state.sequence + 1,
    events: [{ id: state.sequence, text, kind }, ...state.events],
  };
}
function close(
  state: DemoState,
  position: Position,
  reason: ExitReason,
): DemoState {
  const closed: Position = { ...position, status: "closed", reason };
  let next: DemoState = {
    ...state,
    active: null,
    lastClosed: closed,
    completed: [closed, ...state.completed],
    cash: state.cash + closed.amount + closed.profit,
    lastTransfer: 0,
  };
  if (reason === "target")
    next = event(
      next,
      `${position.asset} profit target reached: ${signedEuro(position.profit)}`,
      "target",
    );
  next = event(
    next,
    `${position.asset} sold ${reason === "manual" ? "manually" : "automatically"}${reason === "protection" ? " at the protection level" : ""}. ${signedEuro(position.profit)} ${position.profit < 0 ? "loss" : "profit"}.`,
    "sell",
  );
  return {
    ...next,
    announcement: `${reasonLabel(closed)}. Position closed ${reason === "manual" ? "manually" : "automatically"}. ${signedEuro(closed.profit)}. ${euro(next.cash)} available to send home.`,
  };
}
function evaluate(
  state: DemoState,
  p: Position,
  marketPrice?: number,
): DemoState {
  if (p.protection !== null && p.profit <= -p.protection)
    return close(
      state,
      {
        ...p,
        profit: marketPrice === undefined ? -p.protection : p.profit,
        ...(marketPrice === undefined ? {} : { exitPrice: marketPrice }),
      },
      "protection",
    );
  if (p.autoExit && p.profit >= p.target)
    return close(
      state,
      {
        ...p,
        profit: marketPrice === undefined ? p.target : p.profit,
        ...(marketPrice === undefined ? {} : { exitPrice: marketPrice }),
      },
      "target",
    );
  return { ...state, active: p };
}
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "BUY": {
      if (
        state.active ||
        (action.entryPrice !== undefined &&
          (!Number.isFinite(action.entryPrice) ||
            action.entryPrice <= 0 ||
            action.entryPrice > 1e9)) ||
        !Number.isSafeInteger(action.amount) ||
        action.amount < 100 ||
        action.amount > 1000000 ||
        !Number.isSafeInteger(action.target) ||
        action.target < 1 ||
        (action.protection !== null &&
          (!Number.isSafeInteger(action.protection) ||
            action.protection < 1 ||
            action.protection >= action.amount))
      )
        return state;
      const position: Position = {
        id: state.sequence,
        asset: action.asset,
        amount: action.amount,
        target: action.target,
        protection: action.protection,
        autoExit: action.autoExit,
        entryPrice: action.entryPrice ?? ASSETS[action.asset].price,
        profit: 0,
        status: "active",
      };
      let next: DemoState = {
        ...state,
        active: position,
        lastClosed: null,
        lastTransfer: 0,
        tick: 0,
      };
      next = event(
        next,
        `Bought ${euro(position.amount)} ${position.asset} with simulated funds`,
        "buy",
      );
      next = event(
        next,
        `Profit target set to ${signedEuro(position.target)}${position.autoExit ? " · auto-exit on" : " · manual exit"}`,
        "target",
      );
      return {
        ...next,
        announcement: `${euro(position.amount)} ${position.asset} demo trade opened. Target ${signedEuro(position.target)}. No real funds used.`,
      };
    }
    case "MARKET_PRICE": {
      const p = state.active;
      if (
        !p ||
        !Number.isFinite(action.price) ||
        action.price <= 0 ||
        action.price > 1e9
      )
        return state;
      const profit = Math.max(
        -p.amount + 1,
        Math.round(p.amount * (action.price / p.entryPrice - 1)),
      );
      if (
        !Number.isSafeInteger(profit) ||
        !Number.isSafeInteger(p.amount + profit)
      )
        return state;
      return evaluate(state, { ...p, profit }, action.price);
    }
    case "MOVE": {
      if (!state.active) return state;
      if (action.mode === "tick" && !state.playing) return state;
      const p = state.active;
      const delta =
        action.mode === "rise"
          ? Math.max(1, Math.round(p.target * 0.764))
          : action.mode === "fall"
            ? -Math.max(1, Math.round(p.target * 0.45))
            : Math.round(
                p.target * [0.025, 0.035, -0.018, 0.03][state.tick % 4],
              ) || 1;
      const profit =
        action.mode === "target"
          ? p.target
          : Math.max(-p.amount + 1, p.profit + delta);
      const next = evaluate(
        { ...state, tick: state.tick + 1 },
        { ...p, profit },
      );
      return action.mode !== "tick" && next.active
        ? {
            ...next,
            announcement: `Simulated profit ${signedEuro(profit)}. ${profit >= p.target && !p.autoExit ? "Target reached. Auto-exit is off; sell when ready." : `${progress(next.active)}% toward your target.`}`,
          }
        : next;
    }
    case "SELL":
      return state.active ? close(state, state.active, "manual") : state;
    case "EDIT_TARGET": {
      if (
        !state.active ||
        !Number.isSafeInteger(action.target) ||
        action.target < 1
      )
        return state;
      const next = event(
        state,
        `${state.active.asset} profit target updated to ${signedEuro(action.target)}`,
        "target",
      );
      return evaluate(
        {
          ...next,
          announcement: `Profit target updated to ${signedEuro(action.target)}.`,
        },
        { ...state.active, target: action.target },
        action.live ? currentPrice(state.active) : undefined,
      );
    }
    case "TRANSFER": {
      if (state.cash <= 0) return state;
      const next = event(
        state,
        `${euro(state.cash)} sent to bank •••• 4821 (simulated)`,
        "bank",
      );
      return {
        ...next,
        lastTransfer: state.cash,
        sent: state.sent + state.cash,
        cash: 0,
        announcement: `${euro(state.cash)} sent home in the demo. Available trading cash is now zero. No bank transfer was made.`,
      };
    }
    case "PLAY":
      return { ...state, playing: action.value };
    case "NEW_TRADE":
      return { ...state, lastClosed: null, lastTransfer: 0 };
    case "RESET":
      return {
        ...initialDemo(),
        announcement: "Demo reset. No real funds were affected.",
      };
  }
}
