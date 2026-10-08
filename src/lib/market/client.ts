import {
  freshQuote,
  type MarketDataProvider,
  type MarketQuote,
} from "../market-data";
import { type MarketResult, type Timeframe } from "./models";
export async function fetchMarket<T>(
  asset: string,
  kind: string,
  signal: AbortSignal,
  timeframe?: Timeframe,
): Promise<MarketResult<T>> {
  const query = new URLSearchParams({
    asset,
    kind,
    ...(timeframe ? { timeframe } : {}),
  });
  const response = await fetch("/api/market?" + query, {
    signal,
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok) throw Error("Market data unavailable");
  const result = await response.json();
  if (
    !result ||
    result.source !== "Coinbase Exchange" ||
    typeof result.stale !== "boolean" ||
    !Number.isSafeInteger(result.fetchedAt) ||
    result.fetchedAt <= 0 ||
    result.fetchedAt > Date.now() + 10000 ||
    result.data === undefined
  )
    throw Error("Invalid market envelope");
  return result;
}
export function createServerQuoteProvider(): MarketDataProvider {
  return {
    name: "Coinbase Exchange",
    async fetchQuotes(signal) {
      const rows = await Promise.all(
        (["BTC", "ETH", "SOL"] as const).map(async (asset) => {
          const r = await fetchMarket<MarketQuote>(asset, "quote", signal);
          if (r.stale || !freshQuote(r.data)) throw Error("Stale quote");
          return [asset, r.data] as const;
        }),
      );
      return Object.fromEntries(rows) as Record<
        "BTC" | "ETH" | "SOL",
        MarketQuote
      >;
    },
  };
}
