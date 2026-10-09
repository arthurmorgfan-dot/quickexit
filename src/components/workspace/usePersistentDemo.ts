"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createWorkspaceStore } from "@/lib/account/workspace-store";
import { browserCloudTransport, accountKey } from "@/lib/account/cloud-api";
import { observeAccountSession } from "@/lib/account/auth-session";
import { signOutAccount } from "@/lib/account/auth-flows";
import { browserSupabase } from "@/lib/supabase/browser";
import { watchMarket } from "@/lib/market-data";
import { createServerQuoteProvider } from "@/lib/market/client";
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
    const reduced = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const client = browserSupabase(),
      demo = new URLSearchParams(window.location.search).get("demo") === "1";
    store.setAuthChecking(!!client && !demo);
    store.hydrate(reduced());
    const unsubscribe =
      client && !demo
        ? observeAccountSession(client, store, setAuthError)
        : undefined;
    if (!client || demo) store.setAuthChecking(false);
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
    const offline = () => store.setMarketStatus("unavailable");
    window.addEventListener("offline", offline);
    const stop = watchMarket(
      createServerQuoteProvider(),
      quotes => { if (navigator.onLine) store.receiveMarketQuotes(quotes); },
      status => store.setMarketStatus(navigator.onLine ? status : "unavailable"),
    );
    if (!navigator.onLine) offline();
    return () => { window.removeEventListener("offline", offline); stop(); };
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
    checkingAuth: !snapshot.hydrated || snapshot.checkingAuth,
    ready: snapshot.hydrated && snapshot.ready,
    authError,
    authStatus: (!snapshot.hydrated || snapshot.checkingAuth) ? authError ? "restoration_unavailable" as const : "restoring" as const : snapshot.account ? "authenticated" as const : "signed_out" as const,
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
      const result = await signOutAccount(browserSupabase());
      if (result.signedOut) await store.setAccount(null);
      setAuthError(result.message);
    },
    resetDemo: () =>
      belongs() &&
      store.reset(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
  };
}
