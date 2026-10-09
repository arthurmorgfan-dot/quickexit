import type { Asset } from "../demo-trading";
import { validQuote, type MarketQuote } from "../market-data";
export const TIMEFRAMES = ["1H", "4H", "1D", "1W", "1M", "1Y"] as const;
export const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export const SUPPORTED_INTERVALS = ["1m", "5m", "15m", "1h", "1d"] as const;
export type ChartInterval = (typeof SUPPORTED_INTERVALS)[number];
export type Timeframe = (typeof TIMEFRAMES)[number] | ChartInterval;
export const CHART_TYPES = ["line", "candles", "area", "bars"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const WINDOWS: Record<
  Timeframe,
  { seconds: number; granularity: number }
> = {
  "1m": { seconds: 239 * 60, granularity: 60 },
  "5m": { seconds: 239 * 300, granularity: 300 },
  "15m": { seconds: 239 * 900, granularity: 900 },
  "1h": { seconds: 239 * 3600, granularity: 3600 },
  "1d": { seconds: 239 * 86400, granularity: 86400 },
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
  start?: number;
  end?: number;
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
export function chartPoints(candles: Candle[], type: ChartType): Array<{ time: number; value: number } | { time: number; open: number; high: number; low: number; close: number }> {
  return type === "line" || type === "area"
    ? candles.map((c) => ({ time: c.time, value: c.close }))
    : candles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
}

/** Restart after a missing interval: an SMA requires contiguous observed closes. */
export function movingAverage(candles: Candle[], period: number, granularity: number) {
  if (!Number.isSafeInteger(period) || period < 1 || !Number.isSafeInteger(granularity) || granularity <= 0) throw Error("Invalid moving average");
  const window: number[] = [];
  let sum = 0;
  return candles.flatMap((c, i) => {
    if (i && c.time - candles[i - 1].time !== granularity) { window.length = 0; sum = 0; }
    window.push(c.close); sum += c.close;
    if (window.length > period) sum -= window.shift()!;
    return window.length === period ? [{ time: c.time, value: sum / period }] : [];
  });
}
/** Insert whitespace markers, never price bars, so charts expose absent observations. */
export function withChartGaps<T extends { time: number }>(points: T[], granularity: number): (T | { time: number })[] {
  return points.flatMap((point, i) => i && point.time - points[i - 1].time > granularity
    ? [{ time: points[i - 1].time + granularity }, point] : [point]);
}
export function historyTtl(t: Timeframe) {
  return t === "1m" || t === "1H" || t === "4H" ? 60000 : 300000;
}
export function validateHistory(value: unknown, asset: Asset, timeframe: Timeframe, fetchedAt: number): History {
  const h = value as History;
  const window = WINDOWS[timeframe];
  if (!h || !window || h.asset !== asset || h.timeframe !== timeframe || h.granularity !== window.granularity || !Array.isArray(h.candles) || h.candles.length > 400 || !Number.isSafeInteger(h.gaps) || h.gaps < 0 || h.gaps > 400) throw Error("Invalid history");
  const fetchedEnd = Math.floor(fetchedAt / 1000 / window.granularity) * window.granularity;
  const end = h.end ?? fetchedEnd;
  if (!Number.isSafeInteger(end) || end % window.granularity !== 0 || end > fetchedEnd || fetchedEnd - end > Math.max(60, window.granularity)) throw Error("Invalid history window");
  const start = end - window.seconds;
  if (h.start !== undefined && h.start !== start) throw Error("Invalid history window");
  const candles = h.candles.map(c => {
    const rows = normalizeCandles([[c.time, c.low, c.high, c.open, c.close, c.volume]], start, end, h.granularity);
    if (rows.length !== 1) throw Error("History outside requested window");
    return rows[0];
  });
  if (candles.some((c, i) => i > 0 && c.time <= candles[i - 1].time)) throw Error("Unsorted history");
  const gaps = Math.max(0, Math.floor(window.seconds / window.granularity) + 1 - candles.length);
  if (h.gaps !== gaps) throw Error("Invalid gap count");
  return { ...h, candles };
}
