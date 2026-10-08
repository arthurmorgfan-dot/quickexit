import type { Asset } from "./demo-trading";
export type MarketMode = "live" | "demo";
export type MarketQuote = { price: number; updatedAt: number };
export type MarketSettings = {
  mode: MarketMode;
  quotes: Partial<Record<Asset, MarketQuote>>;
};
export type MarketStatus = "idle" | "loading" | "connected" | "unavailable";
export const MARKET_POLL_MS = 30_000;
export const MARKET_STALE_MS = 120_000;
export const initialMarket = (): MarketSettings => ({
  mode: "demo",
  quotes: {},
});
export const validQuote = (value: unknown): value is MarketQuote => {
  if (!value || typeof value !== "object") return false;
  const q = value as MarketQuote;
  return (
    typeof q.price === "number" &&
    Number.isFinite(q.price) &&
    q.price > 0 &&
    q.price <= 1e9 &&
    Number.isSafeInteger(q.updatedAt) &&
    q.updatedAt > 0
  );
};
export const freshQuote = (q: MarketQuote, now = Date.now()) =>
  validQuote(q) &&
  now - q.updatedAt <= MARKET_STALE_MS &&
  q.updatedAt <= now + 10_000;
/** Provider-neutral, read-only contract. All networking lives in the adapter. */
export interface MarketDataProvider {
  name: string;
  fetchQuotes(signal: AbortSignal): Promise<Record<Asset, MarketQuote>>;
}
export function createCoinbaseProvider(
  request: typeof fetch = fetch,
  now = Date.now,
): MarketDataProvider {
  return {
    name: "Coinbase",
    async fetchQuotes(signal) {
      const entries = await Promise.all(
        (["BTC", "ETH", "SOL"] as const).map(async (asset) => {
          const response = await request(
            `https://api.exchange.coinbase.com/products/${asset}-EUR/ticker`,
            { method: "GET", credentials: "omit", cache: "no-store", signal },
          );
          if (!response.ok) throw new Error("Market data unavailable");
          const data = await response.json();
          const quote = {
            price:
              typeof data?.price === "string" &&
              /^\d+(\.\d+)?$/.test(data.price)
                ? Number(data.price)
                : NaN,
            updatedAt:
              typeof data?.time === "string" ? Date.parse(data.time) : NaN,
          };
          if (!freshQuote(quote, now()))
            throw new Error("Invalid or stale market data");
          return [asset, quote] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<Asset, MarketQuote>;
    },
  };
}
/** Serial polling with timeout, cancellation, and no late deliveries after mode changes. */
export function watchMarket(
  provider: MarketDataProvider,
  onQuotes: (quotes: Record<Asset, MarketQuote>) => void,
  onStatus: (status: MarketStatus) => void,
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController;
  const poll = async () => {
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    onStatus("loading");
    try {
      const quotes = await provider.fetchQuotes(controller.signal);
      if (!stopped) {
        onQuotes(quotes);
      }
    } catch {
      if (!stopped) onStatus("unavailable");
    } finally {
      clearTimeout(timeout);
      if (!stopped) timer = setTimeout(poll, MARKET_POLL_MS);
    }
  };
  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
    controller?.abort();
  };
}
