import { useId } from "react";
import type { History, MarketResult } from "@/lib/market/models";
import { sparklinePath } from "@/lib/market/markets-view";
export default function MarketSparkline({ history, label, loading = false }: { history?: MarketResult<History>; label: string; loading?: boolean }) {
  const id = useId();
  const candles = history?.data.candles ?? [];
  const path = sparklinePath(candles, history?.data.granularity ?? 1);
  const down = candles.length > 1 && candles.at(-1)!.close < candles[0].close;
  return path ? <svg className={`qm-sparkline ${down ? "qm-down" : "qm-up"}`} viewBox="0 0 200 70" role="img" aria-labelledby={id} preserveAspectRatio="none"><title id={id}>{`${label}. ${candles.length} observed closing prices; gaps are not filled.`}</title><path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg> : <span className="qm-spark-empty">{loading ? "Loading history…" : "History unavailable"}</span>;
}
