import { restoreExecution } from "./paper-execution";
import {
  initialMarket,
  validQuote,
  type MarketSettings,
  type MarketQuote,
} from "./market-data";
import {
  ASSETS,
  initialDemo,
  type Asset,
  type DemoState,
  type Position,
  type ActivityEvent,
} from "./demo-trading";

/** One owned key; incompatible schema versions start a clean demo rather than guessing. */
export const PAPER_TRADING_KEY = "quickexit.paper-trading";
export const PAPER_TRADING_VERSION = 3;
const MAX_STORED_LENGTH = 2_000_000;
const MAX_HISTORY = 10_000;
export type DeviceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type PaperTrading = {
  asset: Asset;
  state: DemoState;
  market?: MarketSettings;
};
export type Restoration = PaperTrading & {
  source: "empty" | "restored" | "recovered" | "unavailable";
  migrated?: boolean;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const integer = (
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER - 10,
): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;
export const isAsset = (value: unknown): value is Asset =>
  typeof value === "string" && Object.hasOwn(ASSETS, value);

function position(
  value: unknown,
  status: Position["status"],
  version = PAPER_TRADING_VERSION,
): Position | null {
  if (
    !record(value) ||
    !integer(value.id, -3) ||
    value.id === 0 ||
    !isAsset(value.asset) ||
    value.status !== status ||
    !integer(value.amount, 100, 1_000_000) ||
    !integer(value.target, 1, 1_000_000) ||
    typeof value.autoExit !== "boolean" ||
    typeof value.entryPrice !== "number" ||
    !Number.isFinite(value.entryPrice) ||
    value.entryPrice <= 0 ||
    value.entryPrice > 1_000_000_000 ||
    !integer(
      value.profit,
      value.execution ? -value.amount : -value.amount + 1,
    ) ||
    !Number.isSafeInteger(value.amount + value.profit)
  )
    return null;
  if (
    value.protection !== null &&
    !integer(value.protection, 1, value.amount - 1)
  )
    return null;
  if (value.example !== undefined && typeof value.example !== "boolean")
    return null;
  const example = value.example === true;
  if (example !== value.id < 0 || (example && status !== "closed")) return null;
  const execution =
    value.execution === undefined
      ? undefined
      : restoreExecution(
          value.execution,
          value.amount,
          value.profit,
          status === "closed",
        );
  if (
    execution === null ||
    (execution &&
      (execution.entry.quotedPrice !== value.entryPrice ||
        value.example === true ||
        (status === "closed" && value.exitPrice !== execution.marketPrice)))
  )
    return null;
  if (
    !example &&
    !execution &&
    version === PAPER_TRADING_VERSION &&
    value.legacy !== true
  )
    return null;
  if (
    !execution &&
    value.exitPrice !== undefined &&
    (status !== "closed" ||
      !validQuote({ price: value.exitPrice, updatedAt: 1 }) ||
      value.profit !==
        Math.max(
          -value.amount + 1,
          Math.round(
            value.amount * ((value.exitPrice as number) / value.entryPrice - 1),
          ),
        ))
  )
    return null;
  if (
    status === "active" &&
    (value.reason !== undefined ||
      (value.autoExit && value.profit >= value.target) ||
      (value.protection !== null && value.profit <= -value.protection))
  )
    return null;
  if (
    status === "closed" &&
    !["target", "protection", "manual"].includes(String(value.reason))
  )
    return null;
  if (
    status === "closed" &&
    value.reason === "target" &&
    (!value.autoExit ||
      (value.exitPrice === undefined
        ? value.profit !== value.target
        : value.profit < value.target))
  )
    return null;
  if (
    status === "closed" &&
    value.reason === "protection" &&
    (value.protection === null ||
      (value.exitPrice === undefined
        ? value.profit !== -value.protection
        : value.profit > -value.protection))
  )
    return null;
  const restored: Position = {
    id: value.id,
    asset: value.asset,
    amount: value.amount,
    target: value.target,
    protection: value.protection as number | null,
    autoExit: value.autoExit,
    entryPrice: value.entryPrice,
    profit: value.profit,
    status,
    ...(status === "closed"
      ? { reason: value.reason as Position["reason"] }
      : {}),
    ...(example ? { example: true } : {}),
    ...(execution ? { execution } : !example ? { legacy: true } : {}),
    ...(value.exitPrice === undefined
      ? {}
      : { exitPrice: value.exitPrice as number }),
  };
  return status === "closed" ? Object.freeze(restored) : restored;
}
function activity(value: unknown): ActivityEvent | null {
  if (
    !record(value) ||
    !integer(value.id) ||
    typeof value.text !== "string" ||
    !value.text.trim() ||
    value.text.length > 1000 ||
    !["buy", "target", "sell", "bank", "info"].includes(String(value.kind))
  )
    return null;
  return {
    id: value.id,
    text: value.text,
    kind: value.kind as ActivityEvent["kind"],
  };
}

/** Reconstruct a whitelist of fields and reject inconsistent accounting or positions. */
export function decodePaperTrading(raw: string): PaperTrading | null {
  if (raw.length > MAX_STORED_LENGTH) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (
      !record(data) ||
      ![1, 2, PAPER_TRADING_VERSION].includes(Number(data.version)) ||
      typeof data.version !== "number" ||
      !isAsset(data.selectedAsset) ||
      !record(data.state)
    )
      return null;
    const market = initialMarket();
    if (data.version !== 1 && data.market !== undefined) {
      if (
        !record(data.market) ||
        !["live", "demo"].includes(String(data.market.mode)) ||
        !record(data.market.quotes)
      )
        return null;
      market.mode = data.market.mode as MarketSettings["mode"];
      for (const asset of Object.keys(ASSETS) as Asset[]) {
        const q = data.market.quotes[asset];
        if (q !== undefined && validQuote(q))
          market.quotes[asset] = {
            price: q.price,
            updatedAt: q.updatedAt,
          } as MarketQuote;
      }
    }
    const s = data.state;
    if (
      !Array.isArray(s.completed) ||
      s.completed.length > MAX_HISTORY ||
      !Array.isArray(s.events) ||
      s.events.length === 0 ||
      s.events.length > MAX_HISTORY ||
      !integer(s.cash) ||
      !integer(s.sent) ||
      !integer(s.lastTransfer) ||
      s.lastTransfer > s.sent ||
      (s.lastTransfer > 0 && s.cash > 0) ||
      !integer(s.sequence, 1) ||
      !integer(s.tick) ||
      typeof s.playing !== "boolean"
    )
      return null;
    const active =
      s.active === null
        ? null
        : position(s.active, "active", data.version as number);
    if (s.active !== null && !active) return null;
    const completed = s.completed.map((value) =>
      position(value, "closed", data.version as number),
    );
    const events = s.events.map(activity);
    if (completed.some((p) => p === null) || events.some((e) => e === null))
      return null;
    const validCompleted = completed as Position[];
    const validEvents = events as ActivityEvent[];
    const ids = validCompleted.map((p) => p.id);
    if (active) ids.push(active.id);
    if (
      new Set(ids).size !== ids.length ||
      new Set(validEvents.map((e) => e.id)).size !== validEvents.length
    )
      return null;
    const requestIds = [...(active ? [active] : []), ...validCompleted].flatMap(
      (p) => (p.execution ? [p.execution.entry.requestId] : []),
    );
    if (new Set(requestIds).size !== requestIds.length) return null;
    // Seed examples are always canonical and never contribute to cash or returns.
    const examples = initialDemo().completed;
    if (
      validCompleted.some(
        (p) =>
          p.example &&
          !examples.some((seed) => JSON.stringify(seed) === JSON.stringify(p)),
      )
    )
      return null;
    const realCompleted = validCompleted.filter((p) => !p.example);
    const proceeds = realCompleted.reduce(
      (sum, p) => sum + p.amount + p.profit,
      0,
    );
    if (
      !Number.isSafeInteger(proceeds) ||
      !Number.isSafeInteger(s.cash + s.sent) ||
      proceeds !== s.cash + s.sent
    )
      return null;
    const lastClosedCandidate =
      s.lastClosed === null
        ? null
        : position(s.lastClosed, "closed", data.version as number);
    const lastClosed = lastClosedCandidate
      ? (realCompleted.find(
          (p) =>
            p.id === lastClosedCandidate.id &&
            JSON.stringify(p) === JSON.stringify(lastClosedCandidate),
        ) ?? null)
      : null;
    if ((s.lastClosed !== null && !lastClosed) || (active && lastClosed))
      return null;
    const maxId = Math.max(0, ...ids, ...validEvents.map((e) => e.id));
    return {
      asset: data.selectedAsset,
      market,
      state: {
        active,
        completed: [...realCompleted, ...examples],
        events: validEvents,
        cash: s.cash,
        sent: s.sent,
        lastClosed,
        lastTransfer: s.lastTransfer,
        sequence: Math.max(s.sequence, maxId + 1),
        tick: s.tick,
        playing: s.playing,
        announcement: "",
      },
    };
  } catch {
    return null;
  }
}

export function encodePaperTrading(snapshot: PaperTrading): string {
  const {
    active,
    completed,
    cash,
    sent,
    lastClosed,
    lastTransfer,
    events,
    sequence,
    tick,
    playing,
  } = snapshot.state;
  // Explicit durable fields: future UI/editor state is not silently added to schema v1.
  return JSON.stringify({
    version: PAPER_TRADING_VERSION,
    selectedAsset: snapshot.asset,
    market: snapshot.market ?? initialMarket(),
    state: {
      active,
      completed,
      cash,
      sent,
      lastClosed,
      lastTransfer,
      events,
      sequence,
      tick,
      playing,
    },
  });
}

export function loadPaperTrading(storage: DeviceStorage): Restoration {
  const clean = {
    asset: "BTC" as const,
    state: initialDemo(),
    market: initialMarket(),
  };
  try {
    const raw = storage.getItem(PAPER_TRADING_KEY);
    if (raw === null) return { ...clean, source: "empty" };
    const restored = decodePaperTrading(raw);
    return restored
      ? {
          ...restored,
          source: "restored",
          migrated: JSON.parse(raw).version !== PAPER_TRADING_VERSION,
        }
      : { ...clean, source: "recovered" };
  } catch {
    return { ...clean, source: "unavailable" };
  }
}
export function savePaperTrading(
  storage: DeviceStorage,
  snapshot: PaperTrading,
): boolean {
  try {
    const raw = encodePaperTrading(snapshot);
    if (raw.length > MAX_STORED_LENGTH) return false;
    storage.setItem(PAPER_TRADING_KEY, raw);
    return true;
  } catch {
    return false;
  }
}
export function clearPaperTrading(storage: DeviceStorage): boolean {
  try {
    storage.removeItem(PAPER_TRADING_KEY);
    return true;
  } catch {
    return false;
  }
}
