import {
  initialMarket,
  freshQuote,
  type MarketMode,
  type MarketSettings,
  type MarketQuote,
  type MarketStatus,
} from "./market-data";
import {
  demoReducer,
  ASSETS,
  initialDemo,
  type Asset,
  type DemoAction,
} from "./demo-trading";
import {
  isAsset,
  PAPER_TRADING_KEY,
  clearPaperTrading,
  loadPaperTrading,
  savePaperTrading,
  type DeviceStorage,
  type PaperTrading,
} from "./paper-trading-storage";
export type DeviceSnapshot = PaperTrading & {
  market: MarketSettings;
  marketStatus: MarketStatus;
  hydrated: boolean;
  storageStatus: "loading" | "saved" | "unavailable";
  recovered: boolean;
};
/** Writes after every domain action, not from render or an effect: refresh cannot race a transfer. */
export function createPaperTradingStore(getStorage: () => DeviceStorage) {
  const serverSnapshot: DeviceSnapshot = {
    asset: "BTC",
    state: initialDemo(),
    market: initialMarket(),
    marketStatus: "idle",
    hydrated: false,
    storageStatus: "loading",
    recovered: false,
  };
  let snapshot = serverSnapshot;
  let recoveryBlocked = false;
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
      storageStatus:
        !recoveryBlocked &&
        attempt((storage) => savePaperTrading(storage, next))
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
      market: restored.market ?? initialMarket(),
      marketStatus: "idle",
      state: restored.state,
      hydrated: true,
      storageStatus:
        restored.source === "unavailable" ? "unavailable" : "saved",
      recovered: restored.source === "recovered",
    };
    if (restored.source === "unavailable") publish(next);
    else if (
      restored.source === "recovered" ||
      ("migrated" in restored && restored.migrated) ||
      (initial && restored.source === "empty")
    ) {
      // Preserve unreadable progress before replacing the owned key.
      if (restored.source === "recovered") {
        try {
          const storage = getStorage();
          const raw = storage.getItem(PAPER_TRADING_KEY);
          if (raw !== null) {
            const key = `${PAPER_TRADING_KEY}.recovery.${Date.now()}`;
            storage.setItem(key, raw);
            if (storage.getItem(key) !== raw) throw new Error("Backup failed");
          }
        } catch {
          recoveryBlocked = true;
          publish({ ...next, storageStatus: "unavailable" });
          return;
        }
      }
      write(next);
    } else publish(next);
  };
  const reset = (reducedMotion = false) => {
    if (!snapshot.hydrated) return;
    const removed = attempt(clearPaperTrading);
    if (removed) recoveryBlocked = false;
    const clean = initialDemo();
    // Keep the storage key absent after reset. A reload produces this same clean state.
    publish({
      asset: "BTC",
      market: initialMarket(),
      marketStatus: "idle",
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
      if (action.type === "MARKET_PRICE") return; // Only validated provider quotes can enter live state.
      if (snapshot.market.mode === "live") {
        const feedReady = snapshot.marketStatus === "connected" || snapshot.marketStatus === "loading";
        if ((action.type === "BUY" || action.type === "SELL") && !feedReady) {
          publish({ ...snapshot, state: { ...snapshot.state, announcement: "Market feed unavailable. Reconnect and wait for verified fresh prices before trading." } });
          return;
        }
        if (action.type === "MOVE" || action.type === "PLAY") return;
        if (action.type === "SELL" && snapshot.state.active && (!snapshot.market.quotes[snapshot.state.active.asset] || !freshQuote(snapshot.market.quotes[snapshot.state.active.asset]!))) {
          publish({ ...snapshot, marketStatus: "unavailable", state: { ...snapshot.state, announcement: "A fresh market quote is required to close this paper trade." } });
          return;
        }
        if (action.type === "BUY") {
          const quote = snapshot.market.quotes[action.asset];
          if (!quote || !freshQuote(quote)) {
            publish({ ...snapshot, marketStatus: "unavailable" });
            return;
          }
          action = { ...action, entryPrice: quote.price };
        }
        if (action.type === "EDIT_TARGET") action = { ...action, live: true };
      } else {
        if (action.type === "BUY")
          action = { ...action, entryPrice: undefined };
        if (action.type === "EDIT_TARGET") action = { ...action, live: false };
      }
      if (
        action.type === "BUY" &&
        ((action.expectedMarketMode !== undefined &&
          action.expectedMarketMode !== snapshot.market.mode) ||
          (action.expectedQuote !== undefined &&
            action.expectedQuote !==
              (action.entryPrice ?? ASSETS[action.asset]?.price)))
      ) {
        publish({
          ...snapshot,
          state: {
            ...snapshot.state,
            announcement:
              "Market quote changed. Review the latest estimate and confirm again. No paper trade was opened.",
          },
        });
        return;
      }
      const next = demoReducer(snapshot.state, action);
      if (next !== snapshot.state) write({ ...snapshot, state: next });
    },
    setAsset: (asset: Asset) => {
      if (snapshot.hydrated && isAsset(asset) && asset !== snapshot.asset)
        write({ ...snapshot, asset });
    },
    setMarketMode: (mode: MarketMode) => {
      if (
        !snapshot.hydrated ||
        !["live", "demo"].includes(mode) ||
        mode === snapshot.market.mode
      )
        return;
      // Switching never rebases an entry or evaluates a cached price. Wait for a fresh response.
      write({
        ...snapshot,
        market: { ...snapshot.market, mode },
        marketStatus: "idle",
      });
    },
    setMarketStatus: (marketStatus: MarketStatus) => {
      if (
        snapshot.hydrated &&
        snapshot.market.mode === "live" &&
        snapshot.marketStatus !== marketStatus
      )
        publish({ ...snapshot, marketStatus });
    },
    receiveMarketQuotes: (
      quotes: Record<Asset, MarketQuote>,
      now = Date.now(),
    ) => {
      if (!snapshot.hydrated || snapshot.market.mode !== "live") return;
      const assets: Asset[] = ["BTC", "ETH", "SOL"];
      if (
        !assets.every(
          (asset) =>
            freshQuote(quotes?.[asset], now) &&
            (!snapshot.market.quotes[asset] ||
              quotes[asset].updatedAt >=
                snapshot.market.quotes[asset]!.updatedAt),
        )
      ) {
        publish({ ...snapshot, marketStatus: "unavailable" });
        return;
      }
      const clean = Object.fromEntries(
        assets.map((asset) => [
          asset,
          { price: quotes[asset].price, updatedAt: quotes[asset].updatedAt },
        ]),
      ) as Record<Asset, MarketQuote>;
      const next = snapshot.state.active
        ? demoReducer(snapshot.state, {
            type: "MARKET_PRICE",
            price: clean[snapshot.state.active.asset].price,
            positionId: snapshot.state.active.id,
          })
        : snapshot.state;
      write({
        ...snapshot,
        market: { ...snapshot.market, quotes: clean },
        marketStatus: "connected",
        state: next,
      });
    },
    reset,
  };
}
