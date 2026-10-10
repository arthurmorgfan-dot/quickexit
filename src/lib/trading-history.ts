import type { Asset, Position } from "./demo-trading";
export type HistoryFilters = {
  asset: Asset | "all";
  result: "all" | "profit" | "loss" | "even";
  records: "actual" | "examples" | "all";
  from: string;
  to: string;
};
export const initialHistoryFilters: HistoryFilters = { asset: "all", result: "all", records: "actual", from: "", to: "" };
/** Undated examples/legacy records cannot satisfy a date filter. Never invent exit dates. */
export function filterTrades(trades: readonly Position[], filters: HistoryFilters) {
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : -Infinity;
  const until = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Infinity;
  return trades.filter(p => {
    if (p.status !== "closed") return false;
    if (filters.records === "actual" && p.example || filters.records === "examples" && !p.example) return false;
    if (filters.asset !== "all" && p.asset !== filters.asset) return false;
    if (filters.result === "profit" && p.profit <= 0 || filters.result === "loss" && p.profit >= 0 || filters.result === "even" && p.profit !== 0) return false;
    if (filters.from || filters.to) {
      const date = p.example ? undefined : p.execution?.exit?.closedAt;
      if (date === undefined || !Number.isFinite(date) || !(date >= from && date <= until)) return false;
    }
    return true;
  });
}
