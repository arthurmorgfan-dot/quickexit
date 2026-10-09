import type { Candle, History, MarketResult, Statistics, Timeframe } from "./models";
import { historyTtl } from "./models";
export type MarketFilter = "All" | "Gainers" | "Losers";
export function verifiedChange(stats: MarketResult<Statistics> | undefined, now: number, failed = false, offline = false) {
  return stats && !stats.stale && !failed && !offline && now >= stats.fetchedAt && now - stats.fetchedAt <= 120000 ? stats.data.change : undefined;
}
export function matchesMovement(change: number | undefined, filter: MarketFilter) {
  return filter === "All" || (change !== undefined && (filter === "Gainers" ? change > 0 : change < 0));
}
export function historyLabel(history: MarketResult<History> | undefined, now: number, timeframe: Timeframe, failed = false, offline = false) {
  if (!history?.data.candles.length) return "History unavailable";
  const last = history.data.candles.at(-1)!;
  return history.stale || failed || offline || now - history.fetchedAt > historyTtl(timeframe) || now / 1000 - last.time > history.data.granularity + 120 ? "Last known history" : "Observed history";
}
/** Preserve actual time spacing and break paths at missing buckets. No invented points. */
export function sparklinePath(candles: Candle[], granularity: number) {
  if (candles.length < 2) return "";
  const first = candles[0].time, span = candles.at(-1)!.time - first;
  const low = Math.min(...candles.map(c => c.close)), high = Math.max(...candles.map(c => c.close));
  if (span <= 0 || !Number.isFinite(low) || !Number.isFinite(high)) return "";
  return candles.map((c, i) => {
    const x = 4 + (c.time - first) / span * 192;
    const y = high === low ? 35 : 64 - (c.close - low) / (high - low) * 58;
    return `${!i || c.time - candles[i - 1].time > granularity ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export type MarketSort = "default" | "name" | "price" | "change";
export function sortMarketRows<T extends { name: string; price?: number; change?: number }>(rows: T[], sort: MarketSort): T[] {
  return [...rows].sort((a, b) => {
    if (sort === "default") return 0;
    if (sort === "name") return a.name.localeCompare(b.name);
    const left = a[sort], right = b[sort];
    const l = left !== undefined && Number.isFinite(left), r = right !== undefined && Number.isFinite(right);
    return l && r ? right! - left! || a.name.localeCompare(b.name) : l ? -1 : r ? 1 : a.name.localeCompare(b.name);
  });
}
