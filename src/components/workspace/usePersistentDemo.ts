"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createWorkspaceStore } from "@/lib/account/workspace-store";
import { browserCloudTransport, accountKey } from "@/lib/account/cloud-api";
import { browserSupabase } from "@/lib/supabase/browser";
import { createCoinbaseProvider, watchMarket } from "@/lib/market-data";
import { PAPER_TRADING_KEY } from "@/lib/paper-trading-storage";
export default function usePersistentDemo() {
  const [store] = useState(() =>
    createWorkspaceStore(() => window.localStorage, browserCloudTransport()),
  );
  const [authError, setAuthError] = useState("");
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  useEffect(() => {
    let alive = true,
      authEpoch = 0;
    const reduced = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    store.hydrate(reduced());
    const client = browserSupabase(),
      demo = new URLSearchParams(window.location.search).get("demo") === "1";
    const apply = (session: { user: { id: string; email?: string } } | null) =>
      store.setAccount(
        session
          ? {
              id: session.user.id,
              email: session.user.email ?? "Paper account",
            }
          : null,
      );
    let unsubscribe: (() => void) | undefined;
    if (client && !demo) {
      store.setAuthChecking(true);
      const initialEpoch = authEpoch;
      client.auth
        .getSession()
        .then(({ data, error }) => {
          if (alive && authEpoch === initialEpoch) {
            if (error)
              setAuthError(
                "Account session unavailable. Try Demo or sign in again.",
              );
            void apply(data.session);
          }
        })
        .catch(() => {
          if (alive) {
            setAuthError(
              "Account session unavailable. Try Demo or sign in again.",
            );
            store.setAuthChecking(false);
          }
        });
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        authEpoch++;
        queueMicrotask(() => {
          if (alive) void apply(session);
        });
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } else store.setAuthChecking(false);
    const sync = (event: StorageEvent) => {
      const user = store.getSnapshot().account;
      if (
        event.key === null ||
        event.key === (user ? accountKey(user.id) : PAPER_TRADING_KEY)
      )
        store.reload(reduced());
    };
    const retry = () => void store.retry();
    const interval = window.setInterval(retry, 15000);
    window.addEventListener("storage", sync);
    window.addEventListener("online", retry);
    return () => {
      alive = false;
      unsubscribe?.();
      window.clearInterval(interval);
      window.removeEventListener("storage", sync);
      window.removeEventListener("online", retry);
    };
  }, [store]);
  useEffect(() => {
    if (
      !snapshot.hydrated ||
      !snapshot.ready ||
      snapshot.market.mode !== "live"
    )
      return;
    return watchMarket(
      createCoinbaseProvider(),
      store.receiveMarketQuotes,
      store.setMarketStatus,
    );
  }, [
    store,
    snapshot.hydrated,
    snapshot.ready,
    snapshot.market.mode,
    snapshot.account?.id,
  ]);
  const scopeId = snapshot.account?.id;
  const dispatch = store.scopedDispatch(scopeId);
  const belongs = () => store.getSnapshot().account?.id === scopeId;
  return {
    ...snapshot,
    authError,
    dispatch,
    setAsset: (asset: Parameters<typeof store.setAsset>[0]) => {
      if (belongs()) store.setAsset(asset);
    },
    setMarketMode: (mode: Parameters<typeof store.setMarketMode>[0]) => {
      if (belongs()) store.setMarketMode(mode);
    },
    retrySync: store.retry,
    chooseImport: async (useLocal: boolean) => {
      if (belongs()) await store.chooseImport(useLocal);
    },
    resolveConflict: async (useDevice: boolean) => {
      if (belongs()) await store.resolveConflict(useDevice);
    },
    signOut: async () => {
      setAuthError("");
      try {
        const client = browserSupabase();
        if (!client) return;
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw error;
        await store.setAccount(null);
      } catch {
        setAuthError("Could not sign out. Please retry when connected.");
      }
    },
    resetDemo: () =>
      belongs() &&
      store.reset(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
  };
}
