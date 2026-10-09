import { ASSETS, type Asset } from "../demo-trading";
import { fetchMarket } from "./client";
import { WINDOWS, historyTtl, normalizeStats, validateHistory, type MarketResult, type Statistics, type History, type Timeframe } from "./models";
/** Small tab-local cache, shared across chart remounts; server cache coalesces provider requests. */
export function createIntelligenceReader(request = fetchMarket, now = Date.now) {
  type Entry = { result: MarketResult<Statistics | History>; retryAt: number };
  const cache = new Map<string, Entry>();
  const failures = new Map<string, number>();
  return async function read<T extends Statistics | History>(asset: Asset, kind: "stats" | "history", signal: AbortSignal, timeframe?: Timeframe): Promise<MarketResult<T>> {
    if (!Object.hasOwn(ASSETS, asset) || !["stats", "history"].includes(kind) || (kind === "history" && (!timeframe || !Object.hasOwn(WINDOWS, timeframe)))) throw Error("Invalid market resource");
    signal.throwIfAborted();
    const key = `${asset}:${kind}:${timeframe ?? ""}`;
    const ttl = kind === "stats" ? 60000 : historyTtl(timeframe!);
    const cached = cache.get(key);
    const maxAge = kind === "history" ? 86400000 : 3600000;
    const old = cached && now() - cached.result.fetchedAt <= maxAge ? cached : undefined;
    if (cached && !old) cache.delete(key);
    if (old && !old.result.stale && now() - old.result.fetchedAt < ttl) return old.result as MarketResult<T>;
    if (now() < (old?.retryAt ?? failures.get(key) ?? 0)) {
      if (old) return { ...old.result, stale: true } as MarketResult<T>;
      throw Error("Market retry cooldown");
    }
    try {
      const result = await request<Statistics | History>(asset, kind, signal, timeframe);
      signal.throwIfAborted();
      const data = kind === "stats" ? normalizeStats(result.data) : validateHistory(result.data, asset, timeframe!, result.fetchedAt);
      const validated = { ...result, data };
      // Fixed supported keys bound this cache. Never persist market observations as preferences.
      cache.set(key, { result: validated, retryAt: result.stale ? now() + 30000 : 0 });
      failures.delete(key);
      return validated as MarketResult<T>;
    } catch (error) {
      if (signal.aborted) throw error;
      const delay = error instanceof Error && "retryAfter" in error && typeof error.retryAfter === "number" ? error.retryAfter : 30;
      failures.set(key, now() + delay * 1000);
      if (old) {
        old.retryAt = now() + delay * 1000;
        return { ...old.result, stale: true } as MarketResult<T>;
      }
      throw error;
    }
  };
}
export const readIntelligence = createIntelligenceReader();
