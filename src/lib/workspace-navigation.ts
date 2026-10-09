import type { View } from "./demo-trading";
/** Legacy view names map to consolidated pages without selecting a demo/auth mode. */
export function workspaceView(value: string | null): View {
  if (value === "Home" || value === "Positions") return "Portfolio";
  if (value === "Activity") return "History";
  return value && ["Markets", "Portfolio", "Trade", "History", "Cash Out", "Settings"].includes(value) ? value as View : "Markets";
}
