"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPaperTradingStore } from "@/lib/paper-trading-store";
import { PAPER_TRADING_KEY } from "@/lib/paper-trading-storage";

export default function usePersistentDemo() {
  // The storage getter is invoked only after mount, never by SSR or a state initializer.
  const [store] = useState(() =>
    createPaperTradingStore(() => window.localStorage),
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  useEffect(() => {
    const reduced = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    store.hydrate(reduced());
    const sync = (event: StorageEvent) => {
      if (event.key === PAPER_TRADING_KEY || event.key === null)
        store.reload(reduced());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [store]);
  return {
    ...snapshot,
    dispatch: store.dispatch,
    setAsset: store.setAsset,
    resetDemo: () =>
      store.reset(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
  };
}
