import {
  createPaperTradingStore,
  type DeviceSnapshot,
} from "../paper-trading-store";
import {
  PAPER_TRADING_KEY,
  decodePaperTrading,
  encodePaperTrading,
  type DeviceStorage,
} from "../paper-trading-storage";
import { demoImportPreview, type DemoImportPreview } from "./import-preview";
import { initialDemo } from "../demo-trading";
import { initialMarket } from "../market-data";
import {
  accountKey,
  CloudTransportError,
  decodeCloudRecord,
  type AccountIdentity,
  type CloudTransport,
  type CloudCommand,
} from "./cloud-api";
export type SyncStatus =
  | "demo"
  | "loading"
  | "syncing"
  | "saved"
  | "offline"
  | "conflict"
  | "import"
  | "reauth";
export type WorkspaceSnapshot = DeviceSnapshot & {
  account: AccountIdentity | null;
  syncStatus: SyncStatus;
  ready: boolean;
  checkingAuth: boolean;
  importAvailable: boolean;
  importPreview: DemoImportPreview | null;
  syncMessage: string;
};
type Journal = {
  version: 1;
  owner: string;
  raw: string | null;
  revision: number | null;
  queued: boolean;
  inflight: CloudCommand | null;
};
const cleanRaw = () =>
  encodePaperTrading({
    asset: "BTC",
    state: initialDemo(),
    market: initialMarket(),
  });
// Quotes are a device cache, not shared settings; active valuation is still inside the position.
const cloudRaw = (raw: string) => {
  const p = decodePaperTrading(raw);
  if (!p) throw Error("Invalid device copy");
  return encodePaperTrading({
    ...p,
    market: { mode: p.market?.mode ?? "demo", quotes: {} },
  });
};
const uuid = () => crypto.randomUUID();
function restoreJournal(
  storage: DeviceStorage,
  userId: string,
): Journal | null {
  try {
    const raw = storage.getItem(accountKey(userId));
    if (!raw) return null;
    const j = JSON.parse(raw) as Journal;
    if (
      j.version !== 1 ||
      j.owner !== userId ||
      typeof j.queued !== "boolean" ||
      (j.revision !== null &&
        (!Number.isSafeInteger(j.revision) || j.revision < 0)) ||
      typeof j.raw !== "string" ||
      !decodePaperTrading(j.raw)
    )
      return null;
    if (
      j.inflight &&
      (!/^[0-9a-f-]{36}$/i.test(j.inflight.id) ||
        !["save", "import", "skip_import"].includes(j.inflight.kind) ||
        !Number.isSafeInteger(j.inflight.revision) ||
        j.inflight.revision < 0 ||
        !decodePaperTrading(j.inflight.raw))
    )
      return null;
    return {
      version: 1,
      owner: userId,
      raw: encodePaperTrading(decodePaperTrading(j.raw)!),
      revision: j.revision,
      queued: j.queued,
      inflight: j.inflight ?? null,
    };
  } catch {
    return null;
  }
}
/** Account-scoped write-ahead journal + revision CAS. Guest storage is never repurposed. */
export function createWorkspaceStore(
  getStorage: () => DeviceStorage,
  transport: CloudTransport,
  newId = uuid,
) {
  let inner = createPaperTradingStore(getStorage),
    account: AccountIdentity | null = null;
  let journal: Journal | null = null,
    installing = false,
    ready = false,
    checkingAuth = false;
  let cacheRecovered = false;
  let status: SyncStatus = "demo",
    message = "",
    importAvailable = false,
    importRaw: string | null = null;
  let generation = 0,
    running = false,
    controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  const serverSnapshot: WorkspaceSnapshot = {
    ...inner.getServerSnapshot(),
    account: null,
    syncStatus: "demo",
    ready: false,
    checkingAuth: false,
    importAvailable: false,
    importPreview: null,
    syncMessage: "",
  };
  let snapshot = serverSnapshot;
  const emit = () => {
    snapshot = {
      ...inner.getSnapshot(),
      recovered: inner.getSnapshot().recovered || cacheRecovered,
      account,
      syncStatus: status,
      ready: ready && !checkingAuth,
      checkingAuth,
      importAvailable,
      importPreview: importAvailable ? demoImportPreview(importRaw) : null,
      syncMessage: message,
    };
    listeners.forEach((l) => l());
  };
  const preserveCopy = (key: string, raw: string) => {
    const storage = getStorage();
    const previous = storage.getItem(key);
    if (previous === raw) return;
    storage.setItem(previous ? `${key}.${uuid()}` : key, raw);
  };
  let preserveInvalidCache = false;
  const persist = () => {
    if (preserveInvalidCache)
      throw Error("Original device copy could not be preserved");
    if (journal)
      getStorage().setItem(accountKey(journal.owner), JSON.stringify(journal));
  };
  const persistSafe = () => {
    try {
      persist();
      return true;
    } catch {
      message =
        "Device storage is unavailable. Cloud writes are paused to protect retry history. Keep this page open and retry when storage is available.";
      return false;
    }
  };
  const install = (raw: string) => {
    if (!journal) return;
    installing = true;
    const restored = decodePaperTrading(raw)!;
    const local = journal.raw ? decodePaperTrading(journal.raw) : null;
    journal.raw = encodePaperTrading({
      ...restored,
      market: {
        mode: restored.market?.mode ?? "demo",
        quotes: { ...local?.market?.quotes, ...restored.market?.quotes },
      },
    });
    inner.reload();
    installing = false;
  };
  let unsubscribe = inner.subscribe(emit);
  const timeoutController = () => {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 15000);
    return { c, done: () => clearTimeout(timer) };
  };
  const flush = async () => {
    if (
      !account ||
      !journal ||
      journal.revision === null ||
      !ready ||
      running ||
      status === "conflict" ||
      status === "reauth" ||
      (!journal.queued && !journal.inflight)
    )
      return;
    const epoch = generation,
      userId = account.id;
    running = true;
    status = "syncing";
    emit();
    try {
      while (
        epoch === generation &&
        journal &&
        (journal.queued || journal.inflight)
      ) {
        if (!journal.inflight) {
          journal.inflight = {
            id: newId(),
            revision: journal.revision!,
            kind: "save",
            raw: cloudRaw(journal.raw!),
          };
          journal.queued = false;
        }
        if (!persistSafe()) {
          status = "offline";
          emit();
          return;
        }
        const sent: CloudCommand = journal.inflight;
        const timer = timeoutController();
        controller = timer.c;
        let result;
        try {
          result = await transport.commit(userId, sent, timer.c.signal);
        } finally {
          timer.done();
        }
        if (epoch !== generation || !journal) return;
        const record = decodeCloudRecord(result.record, userId);
        if (
          !["saved", "duplicate"].includes(result.status) ||
          result.committedRevision !== record.revision ||
          record.revision !== sent.revision + 1 ||
          !record.raw ||
          cloudRaw(record.raw) !== sent.raw
        ) {
          status = "conflict";
          message =
            "Another device has a different saved workspace. Your device copy is kept. Choose which copy to use.";
          emit();
          return;
        }
        journal.revision = record.revision;
        journal.inflight = null;
        journal.queued = cloudRaw(journal.raw!) !== sent.raw;
        persistSafe();
      }
      status = "saved";
      message = "Paper trading saved to your account.";
      emit();
    } catch (error) {
      if (epoch === generation) {
        if (error instanceof CloudTransportError && error.kind === "auth") {
          ready = false;
          status = "reauth";
          message = error.message;
          emit();
          return;
        }
        status = "offline";
        message =
          "Cloud sync is unavailable. Your device copy and pending changes are kept; retry when connected.";
        emit();
      }
    } finally {
      if (epoch === generation) {
        running = false;
        controller = null;
      }
    }
  };
  const makeAccountInner = (userId: string) => {
    const adapter: DeviceStorage = {
      getItem: () => journal?.raw ?? null,
      setItem: (_key, raw) => {
        if (!journal) return;
        const before = journal.raw;
        journal.raw = raw;
        if (!installing && before && cloudRaw(before) !== cloudRaw(raw)) {
          journal.queued = true;
          if (status !== "conflict") status = "syncing";
        }
        persist();
      },
      removeItem: () => {
        if (journal) {
          journal.raw = cleanRaw();
          journal.queued = true;
          persist();
        }
      },
    };
    inner = createPaperTradingStore(() => adapter);
    unsubscribe = inner.subscribe(() => {
      emit();
      if (!installing && journal?.queued) void flush();
    });
    installing = true;
    inner.hydrate();
    installing = false;
    if (journal?.owner !== userId) throw Error("Account boundary mismatch");
  };
  const chooseImport = async (useLocal: boolean) => {
    if (!account || !journal || !importAvailable || journal.revision !== 0)
      return;
    const raw = useLocal && importRaw ? importRaw : cleanRaw();
    importAvailable = false;
    ready = true;
    install(raw);
    journal.inflight = {
      id: newId(),
      revision: 0,
      kind: useLocal ? "import" : "skip_import",
      raw: cloudRaw(raw),
    };
    journal.queued = false;
    persistSafe();
    emit();
    await flush();
  };
  const reconcile = async () => {
    if (!account || !journal || running) return;
    const epoch = generation,
      userId = account.id,
      known =
        journal.revision !== null &&
        (journal.revision > 0 || !!journal.inflight || journal.queued);
    running = true;
    const timer = timeoutController();
    controller = timer.c;
    try {
      const record = decodeCloudRecord(
        await transport.load(userId, timer.c.signal),
        userId,
      );
      if (epoch !== generation || !journal) return;
      if (journal.inflight) {
        ready = true;
        running = false;
        await flush();
        return;
      }
      if (journal.queued) {
        ready = true;
        if (record.revision !== journal.revision) {
          status = "conflict";
          message =
            "Another device changed your saved workspace. Your local changes are kept.";
          emit();
          return;
        }
        running = false;
        await flush();
        return;
      }
      journal.revision = record.revision;
      if (record.raw) {
        install(record.raw);
        ready = true;
        status = "saved";
        message = "Paper trading saved to your account.";
        importAvailable = false;
        persistSafe();
        emit();
      } else {
        importAvailable = !record.importDecided;
        status = "import";
        message =
          "Import your device demo, or start a fresh account workspace.";
        ready = false;
        try {
          const raw = getStorage().getItem(PAPER_TRADING_KEY);
          importRaw =
            raw && decodePaperTrading(raw) && cloudRaw(raw) !== cleanRaw()
              ? raw
              : null;
        } catch {
          importRaw = null;
        }
        emit();
        running = false;
        // No existing local state means there is nothing to ask the user to import.
        if (!importRaw) await chooseImport(false);
      }
    } catch (error) {
      if (epoch === generation) {
        if (error instanceof CloudTransportError && error.kind === "auth") {
          ready = false;
          status = "reauth";
          message = error.message;
          emit();
          return;
        }
        ready = known;
        status = "offline";
        message = known
          ? "Cloud sync is unavailable. Your device copy is kept."
          : "Cannot restore your account yet. Retry, or Try Demo; your cloud state will not be overwritten.";
        emit();
      }
    } finally {
      timer.done();
      if (epoch === generation) {
        running = false;
        controller = null;
      }
    }
  };
  const setAccount = async (next: AccountIdentity | null) => {
    checkingAuth = false;
    if (account?.id === next?.id) {
      if (next) account = next;
      emit();
      if (next && status === "reauth") {
        status = "loading";
        await reconcile();
      }
      return;
    }
    generation++;
    controller?.abort();
    running = false;
    unsubscribe();
    account = next;
    cacheRecovered = false;
    ready = false;
    message = "";
    importAvailable = false;
    importRaw = null;
    if (!next) {
      journal = null;
      preserveInvalidCache = false;
      status = "demo";
      inner = createPaperTradingStore(getStorage);
      unsubscribe = inner.subscribe(emit);
      inner.hydrate();
      ready = true;
      emit();
      return;
    }
    let restored: Journal | null = null;
    try {
      restored = restoreJournal(getStorage(), next.id);
    } catch {}
    preserveInvalidCache = false;
    if (!restored) {
      try {
        const original = getStorage().getItem(accountKey(next.id));
        if (original) {
          cacheRecovered = true;
          preserveCopy(`${accountKey(next.id)}.invalid`, original);
          message =
            "This device’s account cache could not be restored. Its original data is kept in a recovery copy; cloud restoration will not replay it.";
        }
      } catch {
        preserveInvalidCache = true;
      }
    }
    journal = restored ?? {
      version: 1,
      owner: next.id,
      raw: null,
      revision: null,
      queued: false,
      inflight: null,
    };
    status = "loading";
    makeAccountInner(next.id);
    emit();
    await reconcile();
  };
  const resolveConflict = async (useDevice: boolean) => {
    if (status !== "conflict" || !account || !journal || running) return;
    const epoch = generation,
      userId = account.id;
    running = true;
    const timer = timeoutController();
    controller = timer.c;
    try {
      const remote = decodeCloudRecord(
        await transport.load(userId, timer.c.signal),
        userId,
      );
      if (epoch !== generation || !journal) return;
      // Preserve the losing device copy for recovery without allowing an automatic replay.
      try {
        preserveCopy(`${accountKey(userId)}.recovery`, journal.raw!);
      } catch {
        status = "conflict";
        message =
          "Could not preserve your device copy. No conflict resolution was applied; restore device storage and retry.";
        emit();
        return;
      }
      journal.revision = remote.revision;
      journal.inflight = null;
      journal.queued = useDevice;
      if (!useDevice) install(remote.raw ?? cleanRaw());
      status = useDevice ? "syncing" : "saved";
      message = "";
      ready = true;
      importAvailable = false;
      persistSafe();
      emit();
      running = false;
      if (useDevice) await flush();
    } catch {
      if (epoch === generation) {
        status = "conflict";
        message =
          "Could not load the latest cloud copy. Both copies are kept; try again when connected.";
        emit();
      }
    } finally {
      timer.done();
      if (epoch === generation) {
        running = false;
        controller = null;
      }
    }
  };
  // Stable handlers are bound to their account, so a pending UI callback cannot
  // mutate a different account after sign-out or an account switch.
  const scopedDispatches = new Map<
    string | undefined,
    (action: Parameters<typeof inner.dispatch>[0]) => void
  >();
  const scopedDispatch = (owner: string | undefined) => {
    let handler = scopedDispatches.get(owner);
    if (!handler) {
      handler = (action) => {
        if (account?.id === owner && ready && !checkingAuth)
          inner.dispatch(action);
      };
      scopedDispatches.set(owner, handler);
    }
    return handler;
  };
  return {
    scopedDispatch,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    hydrate: (reduced = false) => {
      if (inner.getSnapshot().hydrated) return;
      inner.hydrate(reduced);
      if (!account) ready = true;
      emit();
    },
    setAuthChecking: (value: boolean) => {
      checkingAuth = value;
      emit();
    },
    setAccount,
    dispatch: (action: Parameters<typeof inner.dispatch>[0]) => {
      if (ready && !checkingAuth) inner.dispatch(action);
    },
    setAsset: (asset: Parameters<typeof inner.setAsset>[0]) => {
      if (ready && !checkingAuth) inner.setAsset(asset);
    },
    setMarketMode: (mode: Parameters<typeof inner.setMarketMode>[0]) => {
      if (ready && !checkingAuth) inner.setMarketMode(mode);
    },
    setMarketStatus: (s: Parameters<typeof inner.setMarketStatus>[0]) =>
      inner.setMarketStatus(s),
    receiveMarketQuotes: (
      ...args: Parameters<typeof inner.receiveMarketQuotes>
    ) => {
      if (ready && !checkingAuth) inner.receiveMarketQuotes(...args);
    },
    reset: (reduced = false) => {
      if (ready && !checkingAuth) {
        inner.reset(reduced);
        if (account) void flush();
      }
    },
    reload: (reduced = false) => {
      if (!account) {
        inner.reload(reduced);
        return;
      }
      let other: Journal | null = null;
      try {
        other = restoreJournal(getStorage(), account.id);
      } catch {}
      if (
        other &&
        journal &&
        other.raw !== journal.raw &&
        (other.queued || other.inflight || journal.queued || journal.inflight)
      ) {
        status = "conflict";
        message =
          "Another tab has unsynced changes. Your current copy is kept; choose a copy before continuing sync.";
        emit();
        return;
      }
      void reconcile();
    },
    retry: async () => {
      if (status === "conflict" || status === "reauth") return;
      if (journal?.inflight || journal?.queued) await flush();
      else await reconcile();
    },
    chooseImport,
    resolveConflict,
    dispose: () => {
      generation++;
      controller?.abort();
      unsubscribe();
      listeners.clear();
    },
  };
}
