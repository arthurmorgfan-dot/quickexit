import { portfolioSummary, type DemoState } from "./demo-trading";

/** Paid fees only. Estimated active exit fees remain in net valuation, not paid totals. */
export function performanceStatistics(state: DemoState) {
  const trades = state.completed.filter(p => !p.example);
  const realized = portfolioSummary(state).realized;
  const wins = trades.filter(p => p.profit > 0).length;
  const losses = trades.filter(p => p.profit < 0).length;
  return {
    completed: trades.length, wins, losses, breakeven: trades.length - wins - losses,
    winRate: trades.length ? wins / trades.length * 100 : null,
    average: trades.length ? realized / trades.length : null,
    realized,
    fees: trades.reduce((sum, p) => sum + (p.execution?.entry.fee ?? 0) + (p.execution?.exit?.exitFee ?? 0), 0) + (state.active?.execution?.entry.fee ?? 0),
    legacy: trades.filter(p => !p.execution).length,
  };
}
export type PerformancePoint = { time: number; realized: number };
/** Only receipt dates are historical observations; legacy dates and total values cannot be reconstructed. */
export function realizedHistory(state: DemoState): PerformancePoint[] {
  const trades = state.completed.filter(p => !p.example);
  let total = trades.filter(p => !p.execution?.exit).reduce((sum, p) => sum + p.profit, 0);
  const points: PerformancePoint[] = [];
  for (const trade of trades.filter(p => p.execution?.exit).sort((a, b) => a.execution!.exit!.closedAt - b.execution!.exit!.closedAt || a.id - b.id)) {
    total += trade.profit;
    const time = trade.execution!.exit!.closedAt;
    if (points.at(-1)?.time === time) points[points.length - 1] = { time, realized: total };
    else points.push({ time, realized: total });
  }
  return points;
}
export function filterHistory(points: PerformancePoint[], range: "ALL" | "1D" | "1W" | "1M", now: number) {
  const window = { ALL: Infinity, "1D": 86400000, "1W": 604800000, "1M": 2592000000 }[range];
  return points.filter(p => p.time >= now - window && p.time <= now);
}
