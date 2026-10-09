import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { createWorkspaceStore } = loadTypeScript(
  "src/lib/account/workspace-store.ts",
);
const { accountKey, browserCloudTransport, decodeCloudRecord } = loadTypeScript(
  "src/lib/account/cloud-api.ts",
);
const { PAPER_TRADING_KEY: KEY, encodePaperTrading } = loadTypeScript(
  "src/lib/paper-trading-storage.ts",
);
const { paperReceipt } = loadTypeScript("src/lib/paper-execution.ts");
const { initialDemo } = loadTypeScript("src/lib/demo-trading.ts");
const A = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "a@example.test",
  },
  B = { id: "22222222-2222-4222-8222-222222222222", email: "b@example.test" };
const buy = {
  type: "BUY",
  asset: "BTC",
  amount: 10000,
  target: 500,
  protection: null,
  autoExit: true,
  requestId: "cloud-trade",
};
const clean = () => encodePaperTrading({ asset: "BTC", state: initialDemo() });
const settle = async () => {
  for (let i = 0; i < 10; i++)
    await new Promise((resolve) => setImmediate(resolve));
};
function setup() {
  const data = new Map(),
    records = new Map(),
    receipts = new Map();
  let counter = 0,
    offline = false,
    lost = false,
    commits = 0;
  const storage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
  const row = (userId) =>
    structuredClone(
      records.get(userId) ?? {
        userId,
        revision: 0,
        importDecided: false,
        raw: null,
      },
    );
  const transport = {
    load: async (id) => {
      if (offline) throw Error("offline");
      return row(id);
    },
    commit: async (id, c) => {
      if (offline) throw Error("offline");
      const before = row(id),
        key = id + c.id;
      if (receipts.has(key))
        return {
          status: "duplicate",
          record: before,
          committedRevision: receipts.get(key),
        };
      if (c.revision !== before.revision)
        return { status: "conflict", record: before };
      if (c.kind !== "save" && (before.importDecided || before.raw))
        return { status: "import_unavailable", record: before };
      const next = {
        userId: id,
        revision: before.revision + 1,
        importDecided: true,
        raw: c.raw,
      };
      records.set(id, next);
      receipts.set(key, next.revision);
      commits++;
      if (lost) {
        lost = false;
        throw Error("response lost");
      }
      return {
        status: "saved",
        record: row(id),
        committedRevision: next.revision,
      };
    },
  };
  const newId = () =>
    `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  const fresh = () => {
    const s = createWorkspaceStore(() => storage, transport, newId);
    s.hydrate();
    return s;
  };
  return {
    storage,
    data,
    records,
    transport,
    fresh,
    row,
    offline: (v) => (offline = v),
    loseReply: () => (lost = true),
    commits: () => commits,
  };
}
test("guest -> account import -> sign out isolates accounts and preserves the original demo", async () => {
  const f = setup(),
    s = f.fresh();
  s.dispatch(buy);
  const guest = f.storage.getItem(KEY);
  await s.setAccount(A);
  assert.equal(s.getSnapshot().account.id, A.id);
  assert.equal(s.getSnapshot().importAvailable, true);
  assert.equal(s.getSnapshot().ready, false);
  assert.equal(f.commits(), 0);
  s.dispatch(buy);
  assert.equal(s.getSnapshot().state.active, null);
  await s.chooseImport(true);
  assert.equal(s.getSnapshot().state.active.amount, 10000);
  assert.equal(s.getSnapshot().syncStatus, "saved");
  assert.equal(f.storage.getItem(KEY), guest);
  await s.setAccount(B);
  assert.equal(s.getSnapshot().state.active, null);
  assert.equal(s.getSnapshot().account.id, B.id);
  await s.chooseImport(false);
  assert.equal(s.getSnapshot().state.active, null);
  assert.equal(f.row(B.id).raw, clean());
  await s.setAccount(A);
  assert.equal(s.getSnapshot().state.active.amount, 10000);
  await s.setAccount(null);
  assert.equal(s.getSnapshot().state.active.amount, 10000);
  assert.equal(s.getSnapshot().account, null);
  assert.equal(f.storage.getItem(KEY), guest);
  s.dispose();
});
test("one-time import cannot be replayed after reload, sign-in or reset", async () => {
  const f = setup(),
    s = f.fresh();
  s.dispatch(buy);
  await s.setAccount(A);
  await s.chooseImport(true);
  const imported = f.row(A.id);
  await s.chooseImport(true);
  assert.deepEqual(f.row(A.id), imported);
  const next = f.fresh();
  await next.setAccount(A);
  assert.equal(next.getSnapshot().importAvailable, false);
  await next.chooseImport(true);
  assert.equal(f.row(A.id).revision, imported.revision);
  next.reset();
  await settle();
  const reset = f.row(A.id);
  assert.equal(JSON.parse(reset.raw).state.active, null);
  const refresh = f.fresh();
  await refresh.setAccount(A);
  assert.equal(refresh.getSnapshot().importAvailable, false);
  assert.equal(refresh.getSnapshot().state.active, null);
  s.dispose();
  next.dispose();
  refresh.dispose();
});
test("another browser restores the full realistic execution lifecycle, cash and sent-home history", async () => {
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  const s = f.fresh();
  await s.setAccount(A);
  s.dispatch(buy);
  await settle();
  const opened = structuredClone(s.getSnapshot().state.active);
  // A different device has no account cache or guest import.
  const other = createWorkspaceStore(
    () => ({ getItem: () => null, setItem: () => {}, removeItem: () => {} }),
    f.transport,
  );
  other.hydrate();
  await other.setAccount(A);
  assert.deepEqual(other.getSnapshot().state.active, opened);
  other.dispatch({ type: "MOVE", mode: "target" });
  await settle();
  assert.equal(other.getSnapshot().state.cash, 1000500);
  const closed = other.getSnapshot().state.lastClosed;
  const receipt = paperReceipt(closed.amount, closed.execution);
  await s.retry();
  assert.equal(s.getSnapshot().state.cash, 1000500);
  assert.equal(s.getSnapshot().state.active, null);
  assert.deepEqual(
    paperReceipt(closed.amount, s.getSnapshot().state.lastClosed.execution),
    receipt,
  );
  s.dispatch({ type: "SELL" });
  s.dispatch({ type: "MOVE", mode: "target" });
  s.dispatch({
    type: "TRANSFER",
    expectedSequence: s.getSnapshot().state.sequence,
  });
  await settle();
  const reload = f.fresh();
  await reload.setAccount(A);
  assert.equal(reload.getSnapshot().state.cash, 0);
  assert.equal(reload.getSnapshot().state.sent, 1000500);
  const recovered = reload
    .getSnapshot()
    .state.completed.find((p) => !p.example);
  assert.deepEqual(
    paperReceipt(recovered.amount, recovered.execution),
    receipt,
  );
  assert.ok(Object.isFrozen(recovered.execution.exit));
  assert.match(reload.getSnapshot().state.events[0].text, /sent to bank/);
  assert.equal(
    reload.getSnapshot().state.completed.filter((p) => !p.example).length,
    1,
  );
  s.dispose();
  other.dispose();
  reload.dispose();
});
test("offline mutations are durable and a reload resumes the same pending operation", async () => {
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  const s = f.fresh();
  await s.setAccount(A);
  f.offline(true);
  s.dispatch(buy);
  await settle();
  assert.equal(s.getSnapshot().syncStatus, "offline");
  const journal = JSON.parse(f.storage.getItem(accountKey(A.id)));
  assert.ok(journal.inflight.id);
  const reload = f.fresh();
  await reload.setAccount(A);
  assert.equal(reload.getSnapshot().ready, true);
  assert.equal(reload.getSnapshot().state.active.amount, 10000);
  assert.equal(reload.getSnapshot().syncStatus, "offline");
  f.offline(false);
  await reload.retry();
  assert.equal(reload.getSnapshot().syncStatus, "saved");
  assert.equal(f.commits(), 1);
  assert.equal(f.row(A.id).revision, 2);
  s.dispose();
  reload.dispose();
});
test("a lost commit response retries its operation ID without duplicate closes, receipts or cash", async () => {
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  const s = f.fresh();
  await s.setAccount(A);
  s.dispatch(buy);
  await settle();
  f.loseReply();
  s.dispatch({ type: "MOVE", mode: "target" });
  await settle();
  assert.equal(s.getSnapshot().syncStatus, "offline");
  const committed = f.commits();
  const before = structuredClone(JSON.parse(f.row(A.id).raw).state);
  const reload = f.fresh();
  await reload.setAccount(A);
  assert.equal(reload.getSnapshot().syncStatus, "saved");
  assert.equal(f.commits(), committed);
  assert.deepEqual(JSON.parse(f.row(A.id).raw).state, before);
  assert.equal(reload.getSnapshot().state.cash, 1000500);
  s.dispose();
  reload.dispose();
});
test("unknown cloud state is never overwritten when the initial account restore fails", async () => {
  const f = setup();
  f.offline(true);
  const s = f.fresh();
  s.dispatch(buy);
  const guest = f.storage.getItem(KEY);
  await s.setAccount(A);
  assert.equal(s.getSnapshot().ready, false);
  assert.equal(s.getSnapshot().state.active, null);
  s.dispatch(buy);
  s.reset();
  assert.equal(f.commits(), 0);
  assert.equal(f.storage.getItem(KEY), guest);
  f.offline(false);
  await s.retry();
  assert.equal(s.getSnapshot().importAvailable, true);
  await s.chooseImport(false);
  assert.equal(s.getSnapshot().ready, true);
  s.dispose();
});
test("revision conflicts preserve local changes, require an explicit choice, and keep a recovery copy", async () => {
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  const one = f.fresh(),
    two = f.fresh();
  await one.setAccount(A);
  await two.setAccount(A);
  one.setAsset("ETH");
  await settle();
  two.setAsset("SOL");
  await settle();
  assert.equal(two.getSnapshot().syncStatus, "conflict");
  assert.equal(two.getSnapshot().asset, "SOL");
  assert.equal(JSON.parse(f.row(A.id).raw).selectedAsset, "ETH");
  await two.resolveConflict(false);
  assert.equal(two.getSnapshot().asset, "ETH");
  assert.equal(
    JSON.parse(f.storage.getItem(accountKey(A.id) + ".recovery")).selectedAsset,
    "SOL",
  );
  one.setAsset("BTC");
  await settle();
  two.setAsset("SOL");
  await settle();
  assert.equal(two.getSnapshot().syncStatus, "conflict");
  await two.resolveConflict(true);
  assert.equal(JSON.parse(f.row(A.id).raw).selectedAsset, "SOL");
  assert.equal(two.getSnapshot().syncStatus, "saved");
  one.dispose();
  two.dispose();
});
test("late responses cannot expose or apply the previous account state", async () => {
  const f = setup();
  let release;
  const transport = {
    ...f.transport,
    load: async (id) =>
      id === A.id
        ? new Promise((resolve) => (release = resolve))
        : f.transport.load(id),
  };
  const s = createWorkspaceStore(() => f.storage, transport);
  s.hydrate();
  const first = s.setAccount(A);
  await s.setAccount(B);
  const b = s.getSnapshot();
  release({ userId: A.id, revision: 2, importDecided: true, raw: clean() });
  await first;
  assert.equal(s.getSnapshot().account.id, B.id);
  assert.equal(s.getSnapshot().state.active, b.state.active);
  s.dispose();
});
test("corrupt cache and malformed/cross-user cloud records recover without touching another user cache", async () => {
  const f = setup();
  f.storage.setItem(
    accountKey(A.id),
    JSON.stringify({
      version: 1,
      owner: B.id,
      raw: clean(),
      revision: 1,
      queued: true,
    }),
  );
  f.storage.setItem(accountKey(B.id), "keep-b");
  const s = f.fresh();
  await s.setAccount(A);
  assert.equal(f.storage.getItem(accountKey(B.id)), "keep-b");
  assert.equal(s.getSnapshot().state.active, null);
  assert.throws(() =>
    decodeCloudRecord(
      { userId: B.id, revision: 1, importDecided: true, raw: clean() },
      A.id,
    ),
  );
  assert.throws(() =>
    decodeCloudRecord(
      { userId: A.id, revision: 1, importDecided: true, raw: "invalid" },
      A.id,
    ),
  );
  s.dispose();
});
test("transport never accepts a browser-supplied owner and uses private same-origin requests", async () => {
  const calls = [];
  const t = browserCloudTransport(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () =>
        options.method === "GET"
          ? { userId: A.id, revision: 0, importDecided: false, raw: null }
          : {
              status: "saved",
              record: {
                userId: A.id,
                revision: 1,
                importDecided: true,
                raw: clean(),
              },
              committedRevision: 1,
            },
    };
  });
  await t.load(A.id, new AbortController().signal);
  await t.commit(
    A.id,
    { id: crypto.randomUUID(), revision: 0, kind: "save", raw: clean() },
    new AbortController().signal,
  );
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[1].options.credentials, "same-origin");
  const body = JSON.parse(calls[1].options.body);
  assert.equal("userId" in body, false);
  assert.equal("user_id" in body, false);
  assert.equal("raw" in body, false);
});

test("auth checking prevents demo mutations until an account decision is known", () => {
  const f = setup(),
    s = f.fresh();
  s.setAuthChecking(true);
  s.dispatch(buy);
  assert.equal(s.getSnapshot().state.active, null);
  assert.equal(s.getSnapshot().ready, false);
  s.setAuthChecking(false);
  s.dispatch(buy);
  assert.equal(s.getSnapshot().state.active.amount, 10000);
  s.dispose();
});
test("cloud polling retains a device live-price cache without syncing cache-only ticks", async () => {
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  const s = f.fresh();
  await s.setAccount(A);
  s.setMarketMode("live");
  await settle();
  const now = Date.now();
  s.receiveMarketQuotes({
    BTC: { price: 60000, updatedAt: now },
    ETH: { price: 2400, updatedAt: now },
    SOL: { price: 100, updatedAt: now },
  });
  await settle();
  const commits = f.commits();
  await s.retry();
  assert.equal(s.getSnapshot().market.quotes.BTC.price, 60000);
  assert.equal(f.commits(), commits);
  s.dispose();
});
test("mutations queued behind a lost in-flight response survive a refresh in order", async () => {
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  const s = f.fresh();
  await s.setAccount(A);
  f.offline(true);
  s.dispatch(buy);
  await settle();
  s.dispatch({ type: "MOVE", mode: "target" });
  await settle();
  assert.equal(s.getSnapshot().state.cash, 1000500);
  const journal = JSON.parse(f.storage.getItem(accountKey(A.id)));
  assert.ok(journal.inflight);
  assert.equal(journal.queued, true);
  f.offline(false);
  const next = f.fresh();
  await next.setAccount(A);
  assert.equal(next.getSnapshot().syncStatus, "saved");
  assert.equal(next.getSnapshot().state.cash, 1000500);
  assert.equal(f.commits(), 2);
  assert.equal(
    JSON.parse(f.row(A.id).raw).state.completed.filter((p) => !p.example)
      .length,
    1,
  );
  s.dispose();
  next.dispose();
});

test("Strict Mode hydration replay and outages cannot bypass a pending import choice", async () => {
  const f = setup(),
    s = f.fresh();
  s.dispatch(buy);
  await s.setAccount(A);
  assert.equal(s.getSnapshot().ready, false);
  s.hydrate();
  assert.equal(s.getSnapshot().ready, false);
  f.offline(true);
  await s.retry();
  assert.equal(s.getSnapshot().ready, false);
  s.dispatch(buy);
  assert.equal(s.getSnapshot().state.active, null);
  assert.equal(f.commits(), 0);
  s.dispose();
});

test("stable UI actions from a previous account cannot mutate the new account", async () => {
  const f = setup(),
    s = f.fresh();
  const guestAction = s.scopedDispatch(undefined);
  assert.equal(guestAction, s.scopedDispatch(undefined));
  await s.setAccount(A);
  await s.chooseImport(false); // Explicitly confirm the starting portfolio.
  guestAction(buy);
  assert.equal(s.getSnapshot().state.active, null);
  const accountAction = s.scopedDispatch(A.id);
  accountAction(buy);
  await settle();
  assert.ok(s.getSnapshot().state.active);
  await s.setAccount(B);
  accountAction(buy);
  assert.equal(s.getSnapshot().state.active, null);
  s.dispose();
});

test("expired authorization gates account mutations and preserves the exact pending command until reauthentication", async () => {
  const { CloudTransportError } = loadTypeScript(
    "src/lib/account/cloud-api.ts",
  );
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  let expired = false;
  const transport = {
    ...f.transport,
    commit: async (...args) => {
      if (expired) throw new CloudTransportError("auth", 401);
      return f.transport.commit(...args);
    },
  };
  const s = createWorkspaceStore(() => f.storage, transport);
  s.hydrate();
  await s.setAccount(A);
  expired = true;
  s.dispatch(buy);
  await settle();
  assert.equal(s.getSnapshot().syncStatus, "reauth");
  assert.equal(s.getSnapshot().ready, false);
  const pending = JSON.parse(f.storage.getItem(accountKey(A.id))).inflight;
  assert.ok(pending);
  const before = s.getSnapshot().state;
  s.dispatch({ type: "MOVE", mode: "target" });
  assert.equal(s.getSnapshot().state, before);
  await s.retry();
  assert.equal(f.commits(), 0);
  expired = false;
  await s.setAccount(A);
  assert.equal(s.getSnapshot().syncStatus, "saved");
  assert.equal(s.getSnapshot().ready, true);
  assert.equal(f.commits(), 1);
  s.dispatch({ type: "MOVE", mode: "target" });
  await settle();
  const restored = f.fresh();
  await restored.setAccount(A);
  assert.equal(restored.getSnapshot().state.cash, 1000500);
  assert.equal(
    restored.getSnapshot().state.completed.filter((p) => !p.example).length,
    1,
  );
  assert.equal(f.row(A.id).revision, 3);
  s.dispose();
  restored.dispose();
});

test("expired session while restoring a cached account never unlocks it as an offline authorized session", async () => {
  const { CloudTransportError } = loadTypeScript(
    "src/lib/account/cloud-api.ts",
  );
  const f = setup();
  const original = f.fresh();
  await original.setAccount(A);
  original.dispatch(buy);
  await settle();
  original.dispose();
  const saved = f.storage.getItem(accountKey(A.id));
  const s = createWorkspaceStore(() => f.storage, {
    ...f.transport,
    load: async () => {
      throw new CloudTransportError("auth", 401);
    },
  });
  s.hydrate();
  await s.setAccount(A);
  assert.equal(s.getSnapshot().syncStatus, "reauth");
  assert.equal(s.getSnapshot().ready, false);
  assert.equal(f.storage.getItem(accountKey(A.id)), saved);
  await s.setAccount(null);
  assert.equal(s.getSnapshot().account, null);
  assert.equal(s.getSnapshot().state.active, null);
  assert.equal(f.storage.getItem(accountKey(A.id)), saved);
  s.dispose();
});

test("a durable operation journal is required before network writes; storage recovery retries without duplicated fills", async () => {
  const f = setup(),
    s = f.fresh();
  await s.setAccount(A);
  await s.chooseImport(false); // Explicitly confirm the starting portfolio.
  const count = f.commits(),
    original = f.storage.setItem;
  f.storage.setItem = () => {
    throw Error("quota");
  };
  s.dispatch(buy);
  await settle();
  assert.equal(f.commits(), count);
  assert.equal(s.getSnapshot().syncStatus, "offline");
  assert.match(s.getSnapshot().syncMessage, /Cloud writes are paused/);
  assert.equal(s.getSnapshot().state.active.amount, 10000);
  f.storage.setItem = original;
  await s.retry();
  assert.equal(s.getSnapshot().syncStatus, "saved");
  assert.equal(f.commits(), count + 1);
  const restored = f.fresh();
  await restored.setAccount(A);
  assert.equal(restored.getSnapshot().state.active.amount, 10000);
  assert.equal(
    restored.getSnapshot().state.events.filter((e) => e.kind === "buy").length,
    1,
  );
  s.dispose();
  restored.dispose();
});

test("invalid account cache is preserved before restoration and is never replayed to the cloud", async () => {
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  const invalid = '{"version":99,"owner":"unrecognized","raw":"original-data"}';
  f.storage.setItem(accountKey(A.id), invalid);
  const s = f.fresh();
  await s.setAccount(A);
  assert.equal(f.storage.getItem(accountKey(A.id) + ".invalid"), invalid);
  assert.equal(s.getSnapshot().recovered, true);
  assert.equal(s.getSnapshot().state.active, null);
  assert.equal(f.commits(), 0);
  s.dispose();
});

test("conflict resolution never discards a device copy when recovery storage fails", async () => {
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  const one = f.fresh(),
    two = f.fresh();
  await one.setAccount(A);
  await two.setAccount(A);
  one.setAsset("ETH");
  await settle();
  two.setAsset("SOL");
  await settle();
  const original = f.storage.setItem;
  f.storage.setItem = (key, value) => {
    if (key.includes(".recovery")) throw Error("quota");
    original(key, value);
  };
  const commits = f.commits();
  await two.resolveConflict(false);
  assert.equal(two.getSnapshot().syncStatus, "conflict");
  assert.equal(two.getSnapshot().asset, "SOL");
  assert.match(
    two.getSnapshot().syncMessage,
    /No conflict resolution was applied/,
  );
  assert.equal(f.commits(), commits);
  f.storage.setItem = original;
  await two.resolveConflict(false);
  assert.equal(two.getSnapshot().asset, "ETH");
  one.dispose();
  two.dispose();
});

test("recovering an invalid account cache retains earlier recovery copies", async () => {
  const f = setup();
  f.records.set(A.id, {
    userId: A.id,
    revision: 1,
    importDecided: true,
    raw: clean(),
  });
  const key = accountKey(A.id),
    earlier = "earlier-unrestored-data",
    current = "new-unrestored-data";
  f.storage.setItem(key + ".invalid", earlier);
  f.storage.setItem(key, current);
  const s = f.fresh();
  await s.setAccount(A);
  assert.equal(f.storage.getItem(key + ".invalid"), earlier);
  assert.ok(
    [...f.data.entries()].some(
      ([k, v]) => k.startsWith(key + ".invalid.") && v === current,
    ),
  );
  assert.equal(f.commits(), 0);
  s.dispose();
});

test("trade notes sync in the compatible v3 aggregate, preserve receipts, and stay account scoped", async () => {
  const f = setup(), s = f.fresh();
  await s.setAccount(A);
  await s.chooseImport(false); // Explicitly confirm the starting portfolio.
  s.dispatch(buy);
  s.dispatch({ type: "SELL" });
  const trade = s.getSnapshot().state.completed.find(p => !p.example);
  const receipt = JSON.stringify(trade);
  s.dispatch({ type: "JOURNAL", tradeId: trade.id, note: "Follow the exit plan." });
  await settle();
  const payload = JSON.parse(f.row(A.id).raw);
  assert.equal(payload.version, 3);
  assert.equal(payload.state.journal[trade.id], "Follow the exit plan.");
  const next = f.fresh();
  await next.setAccount(A);
  assert.equal(next.getSnapshot().state.journal[trade.id], "Follow the exit plan.");
  assert.deepEqual(next.getSnapshot().state.completed.find(p => p.id === trade.id), JSON.parse(receipt));
  const pending = next.scopedDispatch(A.id);
  await next.setAccount(B);
  pending({ type: "JOURNAL", tradeId: trade.id, note: "Wrong account" });
  assert.equal(next.getSnapshot().state.journal, undefined);
  s.dispose(); next.dispose();
});

test("import review is captured, does not mutate the guest and cannot silently import newer unrelated device progress", async () => {
  const f = setup();
  const guest = f.fresh();
  guest.dispatch(buy);
  guest.dispatch({ type: "SELL" });
  const trade = guest.getSnapshot().state.lastClosed;
  guest.dispatch({ type: "JOURNAL", tradeId: trade.id, note: "Original demo note." });
  const original = f.storage.getItem(KEY);
  const s = f.fresh();
  await s.setAccount(A);
  assert.equal(s.getSnapshot().syncStatus, "import");
  assert.equal(s.getSnapshot().importPreview.completed, 1);
  assert.equal(s.getSnapshot().importPreview.receipts, 1);
  assert.equal(s.getSnapshot().importPreview.notes, 1);
  assert.equal(f.commits(), 0);
  assert.equal(f.storage.getItem(KEY), original);
  // Another guest tab changes its own portfolio after the review was captured.
  guest.dispatch({ type: "NEW_TRADE" });
  guest.dispatch({ ...buy, asset: "ETH", requestId: "separate-guest-progress" });
  const newerGuest = f.storage.getItem(KEY);
  const preview = s.getSnapshot().importPreview;
  await s.chooseImport(true);
  assert.equal(s.getSnapshot().state.active, null);
  assert.equal(s.getSnapshot().state.cash, preview.cash);
  assert.equal(s.getSnapshot().state.journal[trade.id], "Original demo note.");
  assert.equal(f.storage.getItem(KEY), newerGuest);
  assert.equal(s.getSnapshot().importPreview, null);
  await s.chooseImport(true);
  assert.equal(f.commits(), 1);
  s.dispose(); guest.dispose();
});


test("empty-device sign-in and retries remain uninitialized until explicit confirmation", async () => {
  const f = setup(), s = f.fresh();
  const guest = f.storage.getItem(KEY);
  await s.setAccount(A);
  assert.equal(s.getSnapshot().syncStatus, "import");
  assert.equal(s.getSnapshot().ready, false);
  assert.equal(s.getSnapshot().importAvailable, true);
  assert.equal(s.getSnapshot().importPreview, null);
  assert.equal(f.commits(), 0);
  s.dispatch(buy);
  await s.retry();
  assert.equal(f.commits(), 0);
  assert.equal(f.row(A.id).raw, null);
  await s.setAccount(null); // Declining by leaving the account writes nothing.
  assert.equal(f.storage.getItem(KEY), guest);
  const next = f.fresh();
  await next.setAccount(A);
  assert.equal(f.commits(), 0);
  await next.chooseImport(false); // Explicit confirmation.
  assert.equal(f.commits(), 1);
  assert.equal(f.row(A.id).raw, clean());
  await next.chooseImport(false);
  assert.equal(f.commits(), 1);
  assert.equal(f.storage.getItem(KEY), guest);
  s.dispose(); next.dispose();
});

test('unresolved authentication blocks initialization, retry and cloud modifications',async()=>{
 const data=new Map();let writes=0,loads=0;
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const transport={load:async userId=>{loads++;return {userId,revision:0,importDecided:false,raw:null}},commit:async()=>{writes++;throw Error('Unexpected write')}};
 const s=createWorkspaceStore(()=>storage,transport);s.hydrate();await s.setAccount(A);assert.equal(s.getSnapshot().importAvailable,true);
 s.setAuthChecking(true);const baseline=loads;
 await s.chooseImport(false);await s.chooseImport(true);await s.retry();await s.resolveConflict(true);s.dispatch(buy);await settle();
 assert.equal(writes,0);assert.equal(loads,baseline);assert.equal(s.getSnapshot().ready,false);assert.equal(s.getSnapshot().importAvailable,true);s.dispose();
});
