import {
  demoReducer,
  initialDemo,
  type Asset,
  type DemoAction,
} from "./demo-trading";
import {
  isAsset,
  clearPaperTrading,
  loadPaperTrading,
  savePaperTrading,
  type DeviceStorage,
  type PaperTrading,
} from "./paper-trading-storage";
export type DeviceSnapshot = PaperTrading & {
  hydrated: boolean;
  storageStatus: "loading" | "saved" | "unavailable";
  recovered: boolean;
};
/** Writes after every domain action, not from render or an effect: refresh cannot race a transfer. */
export function createPaperTradingStore(getStorage: () => DeviceStorage) {
  const serverSnapshot: DeviceSnapshot = {
    asset: "BTC",
    state: initialDemo(),
    hydrated: false,
    storageStatus: "loading",
    recovered: false,
  };
  let snapshot = serverSnapshot;
  const listeners = new Set<() => void>();
  const publish = (next: DeviceSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const attempt = (operation: (storage: DeviceStorage) => boolean) => {
    try {
      return operation(getStorage());
    } catch {
      return false;
    }
  };
  const write = (next: DeviceSnapshot) =>
    publish({
      ...next,
      storageStatus: attempt((storage) => savePaperTrading(storage, next))
        ? "saved"
        : "unavailable",
    });
  const restore = (reducedMotion: boolean, initial: boolean) => {
    let restored;
    try {
      restored = loadPaperTrading(getStorage());
    } catch {
      restored = {
        asset: "BTC" as const,
        state: initialDemo(),
        source: "unavailable" as const,
      };
    }
    if (restored.source !== "restored" && reducedMotion)
      restored.state = { ...restored.state, playing: false };
    const next: DeviceSnapshot = {
      asset: restored.asset,
      state: restored.state,
      hydrated: true,
      storageStatus:
        restored.source === "unavailable" ? "unavailable" : "saved",
      recovered: restored.source === "recovered",
    };
    if (restored.source === "unavailable") publish(next);
    else if (
      restored.source === "recovered" ||
      (initial && restored.source === "empty")
    )
      write(next);
    else publish(next);
  };
  const reset = (reducedMotion = false) => {
    if (!snapshot.hydrated) return;
    const removed = attempt(clearPaperTrading);
    const clean = initialDemo();
    // Keep the storage key absent after reset. A reload produces this same clean state.
    publish({
      asset: "BTC",
      state: {
        ...clean,
        playing: reducedMotion ? false : clean.playing,
        announcement:
          "Demo reset. Saved positions, activity, and simulated balances cleared.",
      },
      hydrated: true,
      storageStatus: removed ? "saved" : "unavailable",
      recovered: false,
    });
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hydrate: (reducedMotion = false) => {
      if (!snapshot.hydrated) restore(reducedMotion, true);
    },
    reload: (reducedMotion = false) => {
      if (snapshot.hydrated) restore(reducedMotion, false);
    },
    dispatch: (action: DemoAction) => {
      if (!snapshot.hydrated) return;
      if (action.type === "RESET") {
        reset();
        return;
      }
      const next = demoReducer(snapshot.state, action);
      if (next !== snapshot.state) write({ ...snapshot, state: next });
    },
    setAsset: (asset: Asset) => {
      if (snapshot.hydrated && isAsset(asset) && asset !== snapshot.asset)
        write({ ...snapshot, asset });
    },
    reset,
  };
}
