import { CHART_TYPES, SUPPORTED_INTERVALS, type ChartType, type ChartInterval } from "./models";
import type { DeviceStorage } from "../paper-trading-storage";
export const CHART_PREFERENCES_KEY = "quickexit.chart-preferences";
export type ChartPreferences = { type: ChartType; interval: ChartInterval; volume: boolean; sma20: boolean; sma50: boolean };
export const DEFAULT_CHART_PREFERENCES: Readonly<ChartPreferences> = Object.freeze({ type: "line", interval: "15m", volume: false, sma20: false, sma50: false });
export function decodeChartPreferences(raw: string | null): ChartPreferences {
  try {
    if (!raw || raw.length > 1000) return { ...DEFAULT_CHART_PREFERENCES };
    const p = JSON.parse(raw);
    if (p?.version !== 1 || !CHART_TYPES.includes(p.type) || !SUPPORTED_INTERVALS.includes(p.interval) || ![p.volume, p.sma20, p.sma50].every(v => typeof v === "boolean")) return { ...DEFAULT_CHART_PREFERENCES };
    return { type: p.type, interval: p.interval, volume: p.volume, sma20: p.sma20, sma50: p.sma50 };
  } catch { return { ...DEFAULT_CHART_PREFERENCES }; }
}
export function createChartPreferencesStore(getStorage: () => DeviceStorage) {
  const server = { preferences: DEFAULT_CHART_PREFERENCES as ChartPreferences, hydrated: false, saved: true };
  let snapshot = server;
  const listeners = new Set<() => void>();
  const publish = (preferences: ChartPreferences, saved: boolean) => { snapshot = { preferences, hydrated: true, saved }; listeners.forEach(l => l()); };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => server,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reload: () => {
      try { publish(decodeChartPreferences(getStorage().getItem(CHART_PREFERENCES_KEY)), true); }
      catch { publish({ ...DEFAULT_CHART_PREFERENCES }, false); }
    },
    update: (change: Partial<ChartPreferences>) => {
      if (!snapshot.hydrated) return;
      const raw = JSON.stringify({ version: 1, ...snapshot.preferences, ...change });
      const preferences = decodeChartPreferences(raw);
      // Reject unsupported selections rather than replace the user's existing choices.
      if (JSON.stringify(preferences) !== JSON.stringify({ ...snapshot.preferences, ...change })) return;
      try { getStorage().setItem(CHART_PREFERENCES_KEY, raw); publish(preferences, true); }
      catch { publish(preferences, false); }
    },
  };
}
