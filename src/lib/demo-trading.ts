import {
  openPaper,
  sealPaperExecution,
  valuePaper,
  priceForNetProfit,
  validCosts,
  validPrice,
  type PaperExecution,
  type ExecutionCosts,
} from "./paper-execution";
/** Client-only simulation. Integer cents keep mock balances and cash-out consistent. */
export const ASSETS = {
  BTC: { name: "Bitcoin", price: 63421.2, change: 1.24, symbol: "₿" },
  ETH: { name: "Ethereum", price: 2486.75, change: 0.86, symbol: "Ξ" },
  SOL: { name: "Solana", price: 148.32, change: -0.42, symbol: "◎" },
} as const;
export type Asset = keyof typeof ASSETS;
export type View =
  "Markets" | "Home" | "Trade" | "Positions" | "Activity" | "Cash Out" | "Settings";
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
  execution?: PaperExecution;
  legacy?: boolean;
};
export type ActivityEvent = {
  id: number;
  text: string;
  kind: "buy" | "target" | "sell" | "bank" | "info";
};
export type DemoState = {
  journal?: Record<string, string>;
  active: Position | null;
  completed: Position[];
  cash: number;
  /** Fixed funding basis; absent on preserved pre-portfolio snapshots. */
  portfolioCapital?: number;
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
/** Format small quantities without rounding a non-zero fill to zero. */
export const cryptoQuantity = (quantity: number) =>
  new Intl.NumberFormat("en-GB", {
    maximumSignificantDigits: 12,
    useGrouping: false,
  }).format(quantity);
export const currentPrice = (p: Position) =>
  p.execution?.marketPrice ?? p.entryPrice * (1 + p.profit / p.amount);
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
    cash: 1_000_000,
    portfolioCapital: 1_000_000,
    sent: 0,
    lastClosed: null,
    lastTransfer: 0,
    events: [
      {
        id: 0,
        text: "Your €10,000 virtual portfolio is ready. No real money is used.",
        kind: "info",
      },
    ],
    sequence: 1,
    tick: 0,
    playing: true,
    announcement: "",
  };
}
export type DemoAction = (
  | {
      type: "BUY";
      asset: Asset;
      amount: number;
      target: number;
      protection: number | null;
      autoExit: boolean;
      entryPrice?: number;
      /** Quote reviewed by the user; never used to override a Live provider quote. */
      expectedQuote?: number;
      expectedMarketMode?: "live" | "demo";
      costs?: ExecutionCosts;
      requestId?: string;
      now?: number;
    }
  | { type: "MOVE"; mode: "rise" | "fall" | "target" | "tick" }
  | { type: "MARKET_PRICE"; price: number }
  | { type: "JOURNAL"; tradeId: number; note: string }
  | { type: "SELL" }
  | { type: "EDIT_TARGET"; target: number; live?: boolean }
  | { type: "TRANSFER" }
  | { type: "PLAY"; value: boolean }
  | { type: "NEW_TRADE" }
  | { type: "RESET" }
) & { positionId?: number; expectedSequence?: number };
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
  if (
    state.active?.id !== position.id ||
    state.completed.some((p) => p.id === position.id)
  )
    return state;
  const execution = position.execution
    ? {
        ...position.execution,
        exit: {
          ...valuePaper(position.amount, position.execution),
          closedAt: Math.max(Date.now(), position.execution.entry.openedAt),
        },
      }
    : undefined;
  const proceeds =
    execution?.exit.proceeds ?? position.amount + position.profit;
  if (
    !Number.isSafeInteger(proceeds) ||
    proceeds < 0 ||
    !Number.isSafeInteger(state.cash + proceeds) ||
    !Number.isSafeInteger(state.cash + proceeds + state.sent)
  )
    return state;
  if (execution) sealPaperExecution(execution);
  const closed: Position = {
    ...position,
    status: "closed",
    reason,
    ...(execution
      ? {
          execution,
          exitPrice: execution.marketPrice,
          profit: execution.exit!.netProfit,
        }
      : {}),
  };
  Object.freeze(closed);
  let next: DemoState = {
    ...state,
    active: null,
    lastClosed: closed,
    completed: [closed, ...state.completed],
    cash: state.cash + proceeds,
    portfolioCapital: state.portfolioCapital ?? legacyCapital(state),
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
  if (p.execution) {
    if (p.protection !== null && p.profit <= -p.protection)
      return close(state, p, "protection");
    if (p.autoExit && p.profit >= p.target) return close(state, p, "target");
    return { ...state, active: p };
  }
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
  if (
    action.expectedSequence !== undefined &&
    action.expectedSequence !== state.sequence
  )
    return state;
  if (action.positionId !== undefined && action.positionId !== state.active?.id)
    return state;
  switch (action.type) {
    case "JOURNAL": {
      if (typeof action.note !== "string" || action.note.length > 2000 || !state.completed.some(p => p.id === action.tradeId && !p.example)) return state;
      const journal = { ...state.journal };
      if (action.note.trim()) journal[String(action.tradeId)] = action.note;
      else delete journal[String(action.tradeId)];
      return { ...state, journal };
    }
    case "BUY": {
      if (
        state.active ||
        !Object.hasOwn(ASSETS, action.asset) ||
        (action.costs !== undefined && !validCosts(action.costs)) ||
        (action.requestId !== undefined &&
          (typeof action.requestId !== "string" ||
            !action.requestId ||
            action.requestId.length > 100 ||
            state.completed.some(
              (p) => p.execution?.entry.requestId === action.requestId,
            ))) ||
        (action.entryPrice !== undefined &&
          (!Number.isFinite(action.entryPrice) ||
            action.entryPrice <= 0 ||
            action.entryPrice > 1e9)) ||
        !Number.isSafeInteger(action.amount) ||
        action.amount < 100 ||
        action.amount > 1000000 ||
        !Number.isSafeInteger(state.cash) ||
        state.cash < 0 ||
        action.amount > state.cash ||
        !Number.isSafeInteger(action.target) ||
        action.target < 1 ||
        (action.protection !== null &&
          (!Number.isSafeInteger(action.protection) ||
            action.protection < 1 ||
            action.protection >= action.amount))
      )
        return state;
      let execution: PaperExecution;
      try {
        execution = openPaper(
          action.amount,
          action.entryPrice ?? ASSETS[action.asset].price,
          action.now ?? Date.now(),
          action.requestId ?? `paper-${state.sequence}`,
          action.costs,
        );
      } catch {
        return state;
      }
      const position: Position = {
        id: state.sequence,
        asset: action.asset,
        amount: action.amount,
        target: action.target,
        protection: action.protection,
        autoExit: action.autoExit,
        entryPrice: action.entryPrice ?? ASSETS[action.asset].price,
        profit: valuePaper(action.amount, execution).netProfit,
        execution,
        status: "active",
      };
      let next: DemoState = {
        ...state,
        active: position,
        cash: state.cash - action.amount,
        portfolioCapital: state.portfolioCapital ?? legacyCapital(state),
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
      return evaluate(
        {
          ...next,
          announcement: `${euro(position.amount)} ${position.asset} demo trade opened. Net target ${signedEuro(position.target)}. No real funds used.`,
        },
        position,
      );
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
      if (p.execution) {
        const execution = { ...p.execution, marketPrice: action.price };
        const v = valuePaper(p.amount, execution);
        if (!Number.isSafeInteger(v.proceeds) || v.proceeds < 0) return state;
        return evaluate(
          state,
          { ...p, execution, profit: v.netProfit },
          action.price,
        );
      }
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
      let profit =
        action.mode === "target"
          ? p.target
          : Math.max(
              -p.amount + 1,
              (action.mode === "rise" ? Math.max(0, p.profit) : p.profit) +
                delta,
            );
      let updated = { ...p, profit };
      if (p.execution) {
        // Demo controls choose an outcome, then generate the market price that pays for it.
        if (p.protection !== null && profit <= -p.protection)
          profit = -p.protection;
        if (p.autoExit && profit >= p.target) profit = p.target;
        const marketPrice = priceForNetProfit(p.amount, p.execution, profit);
        if (!validPrice(marketPrice)) return state;
        const execution = { ...p.execution, marketPrice };
        updated = {
          ...p,
          execution,
          profit: valuePaper(p.amount, execution).netProfit,
        };
      }
      const next = evaluate({ ...state, tick: state.tick + 1 }, updated);
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
      if (state.cash <= 0 || !Number.isSafeInteger(state.cash + state.sent))
        return state;
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

/** Historical funding is inferred without adding funds or changing saved receipts. */
export function legacyCapital(state: DemoState): number {
  const closed = state.completed.filter((p) => !p.example);
  return (
    state.cash +
    state.sent +
    (state.active?.amount ?? 0) -
    closed.reduce((sum, p) => sum + p.profit, 0)
  );
}
/** Portfolio value is estimated liquidation value after simulated exit costs. */
export function portfolioSummary(state: DemoState) {
  const unrealized = state.active
    ? state.active.execution
      ? valuePaper(state.active.amount, state.active.execution).netProfit
      : state.active.profit
    : 0;
  const realized = state.completed
    .filter((p) => !p.example)
    .reduce((sum, p) => sum + p.profit, 0);
  const invested = state.active?.amount ?? 0;
  return {
    cash: state.cash,
    invested,
    value: state.cash + invested + unrealized,
    realized,
    unrealized,
    netProfit: realized + unrealized,
  };
}
