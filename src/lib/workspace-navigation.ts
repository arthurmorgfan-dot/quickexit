import type { View } from "./demo-trading";
/** Legacy view names map to consolidated pages without selecting a demo/auth mode. */
export function workspaceView(value: string | null): View {
  if (value === "Home" || value === "Positions") return "Portfolio";
  if (value === "Activity") return "History";
  return value && ["Markets", "Portfolio", "Trade", "History", "Cash Out", "Settings"].includes(value) ? value as View : "Portfolio";
}
export function workspaceUrl(current: string, view: View): string {
  const url = new URL(current);
  url.searchParams.set("view", view);
  return url.pathname + url.search + url.hash;
}
export function currentWorkspaceView(): View {
  return workspaceView(new URL(window.location.href).searchParams.get("view"));
}
export function subscribeWorkspaceNavigation(update: () => void) {
  window.addEventListener("popstate", update);
  window.addEventListener("quickexit:navigation", update);
  return () => {
    window.removeEventListener("popstate", update);
    window.removeEventListener("quickexit:navigation", update);
  };
}
