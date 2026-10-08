import type { Asset } from "../demo-trading";
import { validQuote, type MarketQuote } from "../market-data";
export const TIMEFRAMES = ["1H", "4H", "1D", "1W", "1M", "1Y"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
export type ChartType = "line" | "candles";
export const WINDOWS: Record<
  Timeframe,
  { seconds: number; granularity: number }
> = {
  "1H": { seconds: 3600, granularity: 60 },
  "4H": { seconds: 14400, granularity: 300 },
  "1D": { seconds: 86400, granularity: 900 },
  "1W": { seconds: 604800, granularity: 3600 },
  "1M": { seconds: 2592000, granularity: 21600 },
  "1Y": { seconds: 31536000, granularity: 86400 },
};
export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export type Statistics = {
  open: number;
  last: number;
  high: number;
  low: number;
  volume: number;
  change: number;
};
export type MarketResult<T> = {
  data: T;
  fetchedAt: number;
  stale: boolean;
  source: "Coinbase Exchange";
};
export type History = {
  asset: Asset;
  timeframe: Timeframe;
  candles: Candle[];
  granularity: number;
  gaps: number;
};
const numeric = (v: unknown) =>
  typeof v === "number"
    ? v
    : typeof v === "string" && /^\d+(\.\d+)?$/.test(v)
      ? Number(v)
      : NaN;
const price = (v: number) => Number.isFinite(v) && v > 0 && v <= 1e9;
export function normalizeTicker(v: unknown, now: number): MarketQuote {
  const d = v as { price: unknown; time: unknown };
  const q = {
    price: numeric(d?.price),
    updatedAt: typeof d?.time === "string" ? Date.parse(d.time) : NaN,
  };
  if (!validQuote(q) || q.updatedAt > now + 10000)
    throw Error("Invalid ticker");
  return q;
}
export function normalizeStats(v: unknown): Statistics {
  const d = v as Record<string, unknown>;
  const [open, last, high, low, volume] = [
    "open",
    "last",
    "high",
    "low",
    "volume",
  ].map((k) => numeric(d?.[k]));
  if (
    ![open, last, high, low].every(price) ||
    !Number.isFinite(volume) ||
    volume < 0 ||
    high < low ||
    last < low ||
    last > high
  )
    throw Error("Invalid statistics");
  return { open, last, high, low, volume, change: (last / open - 1) * 100 };
}
export function normalizeCandles(
  v: unknown,
  start: number,
  end: number,
  granularity: number,
): Candle[] {
  if (!Array.isArray(v) || v.length > 300) throw Error("Invalid history");
  const byTime = new Map<number, Candle>();
  for (const row of v) {
    if (
      !Array.isArray(row) ||
      row.length !== 6 ||
      !row.every((x) => typeof x === "number" && Number.isFinite(x))
    )
      throw Error("Invalid candle");
    const [time, low, high, open, close, volume] = row;
    if (
      !Number.isSafeInteger(time) ||
      time <= 0 ||
      time % granularity !== 0 ||
      ![low, high, open, close].every(price) ||
      low > Math.min(open, close) ||
      high < Math.max(open, close) ||
      volume < 0
    )
      throw Error("Invalid OHLCV");
    if (time < start || time > end) continue;
    const candle = { time, low, high, open, close, volume };
    if (
      byTime.has(time) &&
      JSON.stringify(byTime.get(time)) !== JSON.stringify(candle)
    )
      throw Error("Conflicting candle");
    byTime.set(time, candle);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
export function dataStatus(
  quote: MarketQuote | undefined,
  stale: boolean,
  now: number,
) {
  if (!quote) return "Unavailable";
  const age = now - quote.updatedAt;
  return stale || age > 120000 ? "Stale" : age > 45000 ? "Delayed" : "Live";
}
export function chartPoints(candles: Candle[], type: ChartType) {
  return type === "line"
    ? candles.map((c) => ({ time: c.time, value: c.close }))
    : candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
}
