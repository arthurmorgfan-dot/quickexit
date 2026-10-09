import { decodePaperTrading } from "../paper-trading-storage";
export function demoImportPreview(raw: string | null) {
  const demo = raw && decodePaperTrading(raw);
  if (!demo) return null;
  const { state, asset, market } = demo;
  const trades = state.completed.filter(p => !p.example);
  return {
    selectedAsset: asset,
    cash: state.cash,
    sent: state.sent,
    active: state.active ? {
      asset: state.active.asset, amount: state.active.amount, target: state.active.target,
      protection: state.active.protection, autoExit: state.active.autoExit,
    } : null,
    completed: trades.length,
    receipts: trades.filter(p => !!p.execution?.exit).length,
    legacy: trades.filter(p => !p.execution).length,
    notes: Object.values(state.journal ?? {}).filter(note => note.trim()).length,
    activity: state.events.length,
    mode: market?.mode ?? "demo",
  };
}
export type DemoImportPreview = NonNullable<ReturnType<typeof demoImportPreview>>;
