"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CHART_PREFERENCES_KEY, createChartPreferencesStore } from "@/lib/market/chart-preferences";
export default function useChartPreferences() {
  const [store] = useState(() => createChartPreferencesStore(() => window.localStorage));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => {
    store.reload();
    const sync = (event: StorageEvent) => { if (event.key === CHART_PREFERENCES_KEY || event.key === null) store.reload(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [store]);
  return { ...snapshot, update: store.update };
}
