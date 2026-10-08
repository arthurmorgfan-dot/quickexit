import type { Asset } from "../demo-trading";
import type { MarketQuote } from "../market-data";
import {
  normalizeTicker,
  normalizeStats,
  normalizeCandles,
  WINDOWS,
  type Timeframe,
  type MarketResult,
  type Statistics,
  type History,
  type Candle,
} from "./models";
export interface IntelligenceProvider {
  quote(asset: Asset): Promise<MarketQuote>;
  stats(asset: Asset): Promise<Statistics>;
  history(asset: Asset, timeframe: Timeframe): Promise<History>;
}
export class MarketFailure extends Error {
  constructor(public retryAfter = 30) {
    super("Market provider unavailable");
  }
}
export function createExchangeProvider(
  request: typeof fetch = fetch,
  now = Date.now,
  sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
): IntelligenceProvider {
  let tail: Promise<unknown> = Promise.resolve(),
    cooldown = 0;
  const get = (path: string): Promise<unknown> => {
    const work = tail
      .then(async () => {
        if (now() < cooldown)
          throw new MarketFailure(Math.ceil((cooldown - now()) / 1000));
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const r = await request(
              "https://api.exchange.coinbase.com/products/" + path,
              {
                method: "GET",
                credentials: "omit",
                cache: "no-store",
                signal: AbortSignal.timeout(8000),
              },
            );
            if (r.status === 429) {
              const value = r.headers.get("retry-after");
              const numericSeconds = Number(value);
              const seconds =
                value && !Number.isFinite(numericSeconds)
                  ? (Date.parse(value) - now()) / 1000
                  : numericSeconds;
              cooldown =
                now() +
                Math.min(
                  300,
                  Math.max(
                    1,
                    Number.isFinite(seconds) && seconds > 0 ? seconds : 30,
                  ),
                ) *
                  1000;
              throw new MarketFailure(Math.ceil((cooldown - now()) / 1000));
            }
            if (!r.ok) {
              if (r.status < 500) throw new MarketFailure(60);
              throw Error("Provider outage");
            }
            return await r.json();
          } catch (error) {
            if (error instanceof MarketFailure || attempt === 1) throw error;
            await sleep(500);
          }
        }
      })
      .finally(() => sleep(120));
    tail = work.catch(() => {});
    return work;
  };
  return {
    quote: async (asset) =>
      normalizeTicker(await get(asset + "-EUR/ticker"), now()),
    stats: async (asset) => normalizeStats(await get(asset + "-EUR/stats")),
    history: async (asset, timeframe) => {
      const { seconds, granularity } = WINDOWS[timeframe];
      const end = Math.floor(now() / 1000 / granularity) * granularity,
        start = end - seconds;
      const candles = new Map<number, Candle>();
      for (let cursor = start; cursor <= end; cursor += 299 * granularity) {
        const until = Math.min(end, cursor + 299 * granularity);
        const query = new URLSearchParams({
          start: new Date(cursor * 1000).toISOString(),
          end: new Date(until * 1000).toISOString(),
          granularity: String(granularity),
        });
        for (const c of normalizeCandles(
          await get(`${asset}-EUR/candles?${query}`),
          cursor,
          until,
          granularity,
        )) {
          const existing = candles.get(c.time);
          if (existing && JSON.stringify(existing) !== JSON.stringify(c))
            throw Error("Conflicting history pages");
          candles.set(c.time, c);
        }
        if (until === end) break;
      }
      const values = [...candles.values()].sort((a, b) => a.time - b.time);
      const gaps = Math.max(
        0,
        Math.floor(seconds / granularity) + 1 - values.length,
      );
      return { asset, timeframe, candles: values, granularity, gaps };
    },
  };
}
/** Bounded process cache, request coalescing and failure cooldown; stale data never becomes a fresh quote. */
export function createMarketService(
  provider: IntelligenceProvider,
  now = Date.now,
) {
  type Entry = { data: unknown; fetchedAt: number; retryAt: number };
  const failures = new Map<string, number>();
  const cache = new Map<string, Entry>(),
    inflight = new Map<string, Promise<MarketResult<unknown>>>();
  async function load<T>(
    key: string,
    ttl: number,
    maxAge: number,
    fetcher: () => Promise<T>,
  ): Promise<MarketResult<T>> {
    const old = cache.get(key);
    const result = (e: Entry, stale: boolean) => ({
      data: e.data as T,
      fetchedAt: e.fetchedAt,
      stale,
      source: "Coinbase Exchange" as const,
    });
    if (old && now() - old.fetchedAt < ttl) return result(old, false);
    if (old && now() < old.retryAt) {
      if (now() - old.fetchedAt <= maxAge) return result(old, true);
      throw new MarketFailure(Math.ceil((old.retryAt - now()) / 1000));
    }
    if (!old && now() < (failures.get(key) ?? 0))
      throw new MarketFailure(
        Math.ceil(((failures.get(key) ?? 0) - now()) / 1000),
      );
    const pending = inflight.get(key);
    if (pending) return pending as Promise<MarketResult<T>>;
    const work = (async () => {
      try {
        const data = await fetcher();
        const entry = { data, fetchedAt: now(), retryAt: 0 };
        cache.set(key, entry);
        return result(entry, false);
      } catch (error) {
        failures.set(
          key,
          now() +
            (error instanceof MarketFailure ? error.retryAfter : 30) * 1000,
        );
        if (old) {
          old.retryAt =
            now() +
            (error instanceof MarketFailure ? error.retryAfter : 30) * 1000;
          if (now() - old.fetchedAt <= maxAge) return result(old, true);
        }
        throw error;
      } finally {
        inflight.delete(key);
      }
    })();
    inflight.set(key, work);
    return work;
  }
  return {
    quote: (asset: Asset) =>
      load("quote:" + asset, 15000, 3600000, () => provider.quote(asset)),
    stats: (asset: Asset) =>
      load("stats:" + asset, 60000, 3600000, () => provider.stats(asset)),
    history: (asset: Asset, t: Timeframe) =>
      load(
        "history:" + asset + ":" + t,
        t === "1H" || t === "4H" ? 60000 : 300000,
        86400000,
        () => provider.history(asset, t),
      ),
  };
}
