"use client";
import { useEffect, useState } from "react";
import type { Asset } from "@/lib/demo-trading";
import { readIntelligence } from "@/lib/market/intelligence-reader";
import { type Statistics, type History, type Timeframe, type MarketResult } from "@/lib/market/models";
export default function useMarketIntelligence(asset: Asset, timeframe: Timeframe, enabled: boolean) {
  const key = `${asset}:${timeframe}`;
  const [state, setState] = useState<{
    key: string; stats?: MarketResult<Statistics>; history?: MarketResult<History>;
    statsError: boolean; historyError: boolean; loading: boolean;
  }>({ key: "", statsError: false, historyError: false, loading: false });
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, running = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    const poll = async () => {
      if (stopped || running) return;
      clearTimeout(timer);
      if (document.hidden) { timer = setTimeout(poll, 60000); return; }
      running = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      setState(previous => previous.key === key ? { ...previous, loading: true } : { key, statsError: false, historyError: false, loading: true });
      const [stats, history] = await Promise.allSettled([
        readIntelligence<Statistics>(asset, "stats", controller.signal),
        readIntelligence<History>(asset, "history", controller.signal, timeframe),
      ]);
      clearTimeout(timeout);
      running = false;
      if (stopped) return;
      setState(previous => ({
        ...(previous.key === key ? previous : { key }), key, loading: false,
        ...(stats.status === "fulfilled" ? { stats: stats.value } : {}),
        ...(history.status === "fulfilled" ? { history: history.value } : {}),
        statsError: stats.status === "rejected", historyError: history.status === "rejected",
      }));
      timer = setTimeout(poll, 60000);
    };
    const visible = () => { if (!document.hidden) void poll(); };
    document.addEventListener("visibilitychange", visible);
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); document.removeEventListener("visibilitychange", visible); };
  }, [asset, timeframe, enabled, key]);
  return state.key === key && enabled ? { ...state, error: state.statsError || state.historyError } : { key, error: false, statsError: false, historyError: false, loading: enabled };
}
