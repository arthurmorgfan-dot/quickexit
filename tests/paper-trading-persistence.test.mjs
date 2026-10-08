import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { loadTypeScript } from "./load-typescript.mjs";
const { initialDemo, currentPrice } = loadTypeScript("src/lib/demo-trading.ts");
const {
  PAPER_TRADING_KEY: KEY,
  PAPER_TRADING_VERSION: VERSION,
  decodePaperTrading,
  encodePaperTrading,
} = loadTypeScript("src/lib/paper-trading-storage.ts");
const { createPaperTradingStore: createStore } = loadTypeScript(
  "src/lib/paper-trading-store.ts",
);
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}
const buy = {
  // Preserve the original zero-cost regression scenarios alongside realistic-cost tests.
  costs: { entryFeeBps: 0, exitFeeBps: 0, spreadBps: 0, slippageBps: 0 },
  type: "BUY",
  asset: "BTC",
  amount: 10000,
  target: 500,
  protection: null,
  autoExit: true,
};
const fresh = (storage) => {
  const store = createStore(() => storage);
  store.hydrate();
  return store;
};
const refresh = (storage) => fresh(storage);

test("requested refresh flow preserves the active trade, €105 proceeds, transfer history, and confirmed reset", () => {
  const storage = memoryStorage();
  let store = fresh(storage);
  store.dispatch({ type: "PLAY", value: false });
  store.dispatch(buy);
  // No debounce or page-unload flush: a new browser session can immediately restore.
  store = refresh(storage);
  let state = store.getSnapshot().state;
  assert.equal(state.active.asset, "BTC");
  assert.equal(state.active.amount, 10000);
  assert.equal(state.active.target, 500);
  assert.equal(state.active.entryPrice, 63421.2);
  assert.equal(state.active.autoExit, true);
  assert.equal(state.playing, false);
  store.dispatch({ type: "MOVE", mode: "target" });
  store = refresh(storage);
  state = store.getSnapshot().state;
  assert.equal(state.active, null);
  assert.equal(state.lastClosed.profit, 500);
  assert.equal(state.lastClosed.reason, "target");
  assert.equal(state.cash, 10500);
  assert.equal(state.completed.filter((p) => !p.example).length, 1);
  store.dispatch({ type: "TRANSFER" });
  store = refresh(storage);
  state = store.getSnapshot().state;
  assert.equal(state.cash, 0);
  assert.equal(state.sent, 10500);
  assert.equal(state.lastTransfer, 10500);
  assert.match(state.events[0].text, /€105.00 sent to bank/);
  store.reset(); // UI invokes only after explicit confirmation.
  assert.equal(storage.getItem(KEY), null);
  assert.equal(store.getSnapshot().asset, "BTC");
  assert.equal(store.getSnapshot().state.playing, true);
  store = refresh(storage);
  assert.deepEqual(store.getSnapshot().state, initialDemo());
});

test("asset, profit, protection, edited target, manual auto-exit mode, settings, and tick phase survive restoration", () => {
  const storage = memoryStorage();
  let store = fresh(storage);
  store.setAsset("ETH");
  store.dispatch({
    ...buy,
    asset: "ETH",
    amount: 25000,
    target: 1000,
    protection: 200,
    autoExit: false,
  });
  store.dispatch({ type: "MOVE", mode: "rise" });
  store.dispatch({ type: "EDIT_TARGET", target: 1250 });
  store.dispatch({ type: "PLAY", value: false });
  const before = store.getSnapshot();
  store = refresh(storage);
  const after = store.getSnapshot();
  assert.equal(after.asset, "ETH");
  assert.deepEqual(after.state.active, before.state.active);
  assert.equal(
    currentPrice(after.state.active),
    currentPrice(before.state.active),
  );
  assert.equal(after.state.tick, before.state.tick);
  assert.deepEqual(after.state.events, before.state.events);
  assert.equal(after.state.playing, false);
  assert.equal(after.state.announcement, "");
  assert.equal(JSON.parse(storage.getItem(KEY)).version, VERSION);
  assert.equal("announcement" in JSON.parse(storage.getItem(KEY)).state, false);
  assert.equal("view" in JSON.parse(storage.getItem(KEY)), false);
});

test("SSR/initial hydration reads no storage, blocks writes, and does not overwrite an existing demo", () => {
  const storage = memoryStorage();
  const first = fresh(storage);
  first.dispatch(buy);
  const saved = storage.getItem(KEY);
  let reads = 0;
  const store = createStore(() => {
    reads++;
    return storage;
  });
  assert.equal(store.getSnapshot(), store.getServerSnapshot());
  assert.equal(store.getSnapshot().hydrated, false);
  store.dispatch({ type: "TRANSFER" });
  store.setAsset("SOL");
  store.reset();
  assert.equal(reads, 0);
  assert.equal(storage.getItem(KEY), saved);
  store.hydrate();
  assert.equal(store.getSnapshot().state.active.amount, 10000);
  assert.equal(store.getServerSnapshot().hydrated, false);
  assert.equal(store.getServerSnapshot().state.active, null);
  store.hydrate(); // Strict Mode effect replay is idempotent.
  assert.equal(reads, 1);
  assert.equal(storage.getItem(KEY), saved);
});

test("the React hook server-renders without window or localStorage and with the clean hydration snapshot", () => {
  const { default: usePersistentDemo } = loadTypeScript(
    "src/components/workspace/usePersistentDemo.ts",
  );
  function Probe() {
    const snapshot = usePersistentDemo();
    return createElement(
      "span",
      null,
      `${snapshot.asset}:${snapshot.hydrated}:${snapshot.storageStatus}`,
    );
  }
  assert.equal(
    renderToString(createElement(Probe)),
    "<span>BTC:false:loading</span>",
  );
});

test("malformed, incompatible, and inconsistent stored data recover to a clean versioned demo", () => {
  const base = JSON.parse(
    encodePaperTrading({ asset: "BTC", state: initialDemo() }),
  );
  const invalid = [
    "{",
    "null",
    "[]",
    JSON.stringify({ ...base, version: 0 }),
    JSON.stringify({ ...base, version: VERSION + 1 }),
    JSON.stringify({ ...base, selectedAsset: "DOGE" }),
    JSON.stringify({ ...base, state: { ...base.state, cash: 10500 } }),
    JSON.stringify({ ...base, state: { ...base.state, sent: -1 } }),
    JSON.stringify({
      ...base,
      state: { ...base.state, events: [{ id: 0, text: "", kind: "bank" }] },
    }),
    JSON.stringify({ ...base, state: { ...base.state, playing: "yes" } }),
    JSON.stringify({
      ...base,
      state: { ...base.state, lastClosed: { id: 999 } },
    }),
  ];
  for (const raw of invalid) {
    const storage = memoryStorage();
    storage.setItem(KEY, raw);
    const store = fresh(storage);
    assert.equal(store.getSnapshot().recovered, true, raw);
    assert.deepEqual(store.getSnapshot().state, initialDemo());
    assert.ok(decodePaperTrading(storage.getItem(KEY)));
  }
});

test("restoration rejects malformed positions, duplicate IDs, invalid exits, prices, and balances", () => {
  const storage = memoryStorage();
  const store = fresh(storage);
  store.dispatch(buy);
  const activeBase = JSON.parse(storage.getItem(KEY));
  for (const patch of [
    { asset: "constructor" },
    { amount: -10 },
    { entryPrice: 0 },
    { entryPrice: "63421" },
    { target: 0 },
    { protection: 10000 },
    { profit: -10000 },
    { profit: 500 },
    { example: true },
    { autoExit: "true" },
  ]) {
    const value = structuredClone(activeBase);
    Object.assign(value.state.active, patch);
    assert.equal(decodePaperTrading(JSON.stringify(value)), null);
  }
  store.dispatch({ type: "MOVE", mode: "target" });
  const closedBase = JSON.parse(storage.getItem(KEY));
  const duplicate = structuredClone(closedBase);
  duplicate.state.completed.push(duplicate.state.completed[0]);
  assert.equal(decodePaperTrading(JSON.stringify(duplicate)), null);
  const invalidExit = structuredClone(closedBase);
  invalidExit.state.completed[0].profit = 400;
  assert.equal(decodePaperTrading(JSON.stringify(invalidExit)), null);
  const duplicateEvent = structuredClone(closedBase);
  duplicateEvent.state.events.push(duplicateEvent.state.events[0]);
  assert.equal(decodePaperTrading(JSON.stringify(duplicateEvent)), null);
});

test("unknown fields and announcements are sanitized and sequence IDs are repaired safely", () => {
  const value = JSON.parse(
    encodePaperTrading({ asset: "SOL", state: initialDemo() }),
  );
  value.sessionToken = "not part of the schema";
  value.state.announcement = "Do not replay";
  value.state.editorOpen = true;
  value.state.events[0].id = 9;
  value.state.events[0].html = "ignored";
  const restored = decodePaperTrading(JSON.stringify(value));
  assert.equal(restored.state.sequence, 10);
  assert.equal(restored.state.announcement, "");
  assert.equal("sessionToken" in restored, false);
  assert.equal("editorOpen" in restored.state, false);
  assert.equal("html" in restored.state.events[0], false);
});

test("reset affects only the owned key and restores the clean demo", () => {
  const storage = memoryStorage();
  storage.setItem("unrelated-app", "keep me");
  const store = fresh(storage);
  store.setAsset("SOL");
  store.dispatch(buy);
  store.reset();
  assert.equal(storage.getItem(KEY), null);
  assert.equal(storage.getItem("unrelated-app"), "keep me");
  assert.equal(store.getSnapshot().state.active, null);
  assert.equal(store.getSnapshot().state.cash, 0);
  assert.equal(store.getSnapshot().state.sent, 0);
  assert.equal(
    store.getSnapshot().state.completed.filter((p) => !p.example).length,
    0,
  );
});

test("storage access, quota, and removal failures retain a usable demo without claiming it is saved", () => {
  const denied = () => {
    throw new Error("Storage disabled");
  };
  const unavailable = createStore(denied);
  unavailable.hydrate();
  assert.equal(unavailable.getSnapshot().hydrated, true);
  assert.equal(unavailable.getSnapshot().storageStatus, "unavailable");
  unavailable.dispatch(buy);
  assert.equal(unavailable.getSnapshot().state.active.amount, 10000);
  unavailable.reset();
  assert.equal(unavailable.getSnapshot().state.active, null);
  assert.equal(unavailable.getSnapshot().storageStatus, "unavailable");
  const quota = fresh({
    getItem: () => null,
    setItem: denied,
    removeItem: denied,
  });
  quota.dispatch(buy);
  assert.equal(quota.getSnapshot().storageStatus, "unavailable");
  assert.equal(quota.getSnapshot().state.active.amount, 10000);
  quota.reset();
  assert.equal(quota.getSnapshot().storageStatus, "unavailable");
  assert.equal(quota.getSnapshot().state.cash, 0);
});

test("other-tab restoration and reset synchronize without write loops or offline price changes", () => {
  const storage = memoryStorage();
  const first = fresh(storage),
    second = fresh(storage);
  first.dispatch({ type: "PLAY", value: false });
  first.dispatch(buy);
  first.dispatch({ type: "MOVE", mode: "rise" });
  second.reload();
  assert.equal(second.getSnapshot().state.active.profit, 382);
  assert.equal(second.getSnapshot().state.tick, 1);
  const raw = storage.getItem(KEY);
  second.reload();
  assert.equal(storage.getItem(KEY), raw);
  first.reset();
  second.reload();
  assert.equal(second.getSnapshot().state.active, null);
  assert.equal(storage.getItem(KEY), null);
});

test("fresh and reset demos respect reduced motion, while deliberate saved preferences survive refresh", () => {
  const storage = memoryStorage();
  let store = createStore(() => storage);
  store.hydrate(true);
  assert.equal(store.getSnapshot().state.playing, false);
  store.dispatch({ type: "PLAY", value: true });
  store = createStore(() => storage);
  store.hydrate(true);
  assert.equal(store.getSnapshot().state.playing, true);
  store.reset(true);
  assert.equal(store.getSnapshot().state.playing, false);
});
