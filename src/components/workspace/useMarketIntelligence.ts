"use client";
import { useEffect, useState } from "react";
import type { Asset } from "@/lib/demo-trading";
import { fetchMarket } from "@/lib/market/client";
import {
  normalizeStats,
  normalizeCandles,
  WINDOWS,
  type Statistics,
  type History,
  type Timeframe,
  type MarketResult,
} from "@/lib/market/models";
export default function useMarketIntelligence(
  asset: Asset,
  timeframe: Timeframe,
  enabled: boolean,
) {
  const key = asset + timeframe;
  const [state, setState] = useState<{
    key: string;
    stats?: MarketResult<Statistics>;
    history?: MarketResult<History>;
    error: boolean;
    loading: boolean;
  }>({ key: "", error: false, loading: false });
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    const poll = async () => {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      setState((previous) =>
        previous.key === key
          ? { ...previous, loading: true }
          : { key, error: false, loading: true },
      );
      const results = await Promise.allSettled([
        fetchMarket<Statistics>(asset, "stats", controller.signal),
        fetchMarket<History>(asset, "history", controller.signal, timeframe),
      ]);
      clearTimeout(timeout);
      if (stopped) return;
      setState((previous) => {
        const next: typeof previous = {
          ...(previous.key === key ? previous : { key }),
          key,
          error: false,
          loading: false,
        };
        for (const [i, result] of results.entries()) {
          try {
            if (result.status !== "fulfilled") throw Error("Unavailable");
            if (i === 0)
              next.stats = {
                ...result.value,
                data: normalizeStats(result.value.data),
              } as MarketResult<Statistics>;
            else {
              const r = result.value as MarketResult<History>,
                h = r.data;
              if (
                h.asset !== asset ||
                h.timeframe !== timeframe ||
                h.granularity !== WINDOWS[timeframe].granularity ||
                !Array.isArray(h.candles) ||
                h.candles.length > 400 ||
                !Number.isSafeInteger(h.gaps) ||
                h.gaps < 0 ||
                h.gaps > 400
              )
                throw Error("Invalid history");
              const end = Math.floor(r.fetchedAt / 1000),
                start =
                  end -
                  WINDOWS[timeframe].seconds -
                  WINDOWS[timeframe].granularity;
              // Validate individual provider-normalized bars; no interpolation or invented prices.
              const candles = h.candles.flatMap((c) =>
                normalizeCandles(
                  [[c.time, c.low, c.high, c.open, c.close, c.volume]],
                  start,
                  end,
                  h.granularity,
                ),
              );
              if (
                candles.some((c, i) => i > 0 && c.time <= candles[i - 1].time)
              )
                throw Error("Unsorted history");
              next.history = { ...r, data: { ...h, candles } };
            }
          } catch {
            next.error = true;
          }
        }
        return next;
      });
      timer = setTimeout(poll, 60000);
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [asset, timeframe, enabled, key]);
  return state.key === key && enabled
    ? state
    : { key, error: false, loading: enabled };
}
