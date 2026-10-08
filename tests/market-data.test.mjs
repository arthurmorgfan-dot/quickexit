import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const { createCoinbaseProvider, watchMarket, MARKET_STALE_MS } = loadTypeScript(
  "src/lib/market-data.ts",
);
const { createPaperTradingStore } = loadTypeScript(
  "src/lib/paper-trading-store.ts",
);
const { decodePaperTrading, PAPER_TRADING_KEY } = loadTypeScript(
  "src/lib/paper-trading-storage.ts",
);
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
const quotes = (price = 60000, now = Date.now()) => ({
  BTC: { price, updatedAt: now },
  ETH: { price: 2400, updatedAt: now },
  SOL: { price: 100, updatedAt: now },
});
function setup() {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  const fresh = () => {
    const store = createPaperTradingStore(() => storage);
    store.hydrate();
    return store;
  };
  return { storage, store: fresh(), fresh };
}
test("read-only adapter requests all three EUR tickers without credentials and parses timestamps", async () => {
  const now = Date.now(),
    calls = [];
  const provider = createCoinbaseProvider(
    async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          price: "60000.25",
          time: new Date(now).toISOString(),
        }),
      };
    },
    () => now,
  );
  const result = await provider.fetchQuotes(new AbortController().signal);
  assert.deepEqual(Object.keys(result), ["BTC", "ETH", "SOL"]);
  assert.equal(result.BTC.price, 60000.25);
  assert.equal(result.SOL.updatedAt, now);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.match(call.url, /products\/(BTC|ETH|SOL)-EUR\/ticker$/);
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.credentials, "omit");
  }
});
test("provider rejects HTTP errors, malformed, stale and future quotes", async () => {
  const now = Date.now();
  for (const payload of [
    null,
    {},
    { price: "NaN", time: new Date(now).toISOString() },
    { price: "0", time: new Date(now).toISOString() },
    { price: 60000, time: new Date(now).toISOString() },
    { price: "60000", time: "invalid" },
    { price: "60000", time: new Date(now - MARKET_STALE_MS - 1).toISOString() },
    { price: "60000", time: new Date(now + 60000).toISOString() },
  ]) {
    const provider = createCoinbaseProvider(
      async () => ({ ok: true, json: async () => payload }),
      () => now,
    );
    await assert.rejects(provider.fetchQuotes(new AbortController().signal));
  }
  await assert.rejects(
    createCoinbaseProvider(async () => ({ ok: false })).fetchQuotes(
      new AbortController().signal,
    ),
  );
});
test("live quotes calculate P&L from a fixed entry and close at the observed market value", () => {
  const { store, fresh } = setup();
  store.setMarketMode("live");
  store.receiveMarketQuotes(quotes());
  store.dispatch(buy);
  assert.equal(store.getSnapshot().state.active.entryPrice, 60000);
  store.receiveMarketQuotes(quotes(61200));
  assert.equal(store.getSnapshot().state.active.profit, 200);
  store.receiveMarketQuotes(quotes(59400));
  assert.equal(store.getSnapshot().state.active.profit, -100);
  assert.equal(store.getSnapshot().state.active.entryPrice, 60000);
  store.receiveMarketQuotes(quotes(63600)); // Actual quote +6%, never force a +5% price.
  const state = store.getSnapshot().state;
  assert.equal(state.active, null);
  assert.equal(state.lastClosed.profit, 600);
  assert.equal(state.lastClosed.exitPrice, 63600);
  assert.equal(state.cash, 10600);
  assert.equal(fresh().getSnapshot().state.cash, 10600);
});
test("live protection, manual sell, edited targets, and auto-exit off keep accounting restorable", () => {
  for (const scenario of ["protection", "manual", "edit", "off"]) {
    const { store, fresh } = setup();
    store.setMarketMode("live");
    store.receiveMarketQuotes(quotes());
    store.dispatch({
      ...buy,
      protection: scenario === "protection" ? 100 : null,
      autoExit: scenario !== "off",
    });
    store.receiveMarketQuotes(
      quotes(scenario === "protection" ? 58800 : 61200),
    );
    if (scenario === "manual") store.dispatch({ type: "SELL" });
    if (scenario === "edit")
      store.dispatch({ type: "EDIT_TARGET", target: 100 });
    if (scenario === "off") store.receiveMarketQuotes(quotes(66000));
    const state = store.getSnapshot().state;
    if (scenario === "off") assert.equal(state.active.profit, 1000);
    else assert.equal(state.cash, scenario === "protection" ? 9800 : 10200);
    assert.deepEqual(fresh().getSnapshot().state.active, state.active);
    assert.equal(fresh().getSnapshot().state.cash, state.cash);
  }
});
test("invalid/stale/out-of-order responses and provider outages never mutate positions or balances", () => {
  const { store, storage } = setup();
  const now = Date.now();
  store.setMarketMode("live");
  store.receiveMarketQuotes(quotes(60000, now));
  store.dispatch(buy);
  const before = storage.getItem(PAPER_TRADING_KEY);
  for (const invalid of [
    null,
    {},
    quotes(-1, now),
    quotes(NaN, now),
    quotes(1e10, now),
    quotes(62000, now - MARKET_STALE_MS - 1),
    quotes(62000, now + 60000),
    quotes(62000, now - 1),
  ]) {
    store.receiveMarketQuotes(invalid, now);
    assert.equal(store.getSnapshot().marketStatus, "unavailable");
    assert.equal(storage.getItem(PAPER_TRADING_KEY), before);
    assert.equal(store.getSnapshot().state.active.profit, 0);
    assert.equal(store.getSnapshot().state.active.entryPrice, 60000);
  }
  store.setMarketStatus("unavailable");
  assert.equal(storage.getItem(PAPER_TRADING_KEY), before);
});
test("Live ↔ Demo disables manipulations in Live, retains entries, and ignores late responses in Demo", () => {
  const { store } = setup();
  store.setMarketMode("live");
  store.receiveMarketQuotes(quotes());
  store.dispatch(buy);
  for (const mode of ["rise", "fall", "target", "tick"])
    store.dispatch({ type: "MOVE", mode });
  store.dispatch({ type: "MARKET_PRICE", price: 66000 });
  assert.equal(store.getSnapshot().state.active.profit, 0);
  store.setMarketMode("demo");
  store.dispatch({ type: "MOVE", mode: "rise" });
  assert.equal(store.getSnapshot().state.active.profit, 382);
  store.receiveMarketQuotes(quotes(66000));
  assert.equal(store.getSnapshot().state.active.profit, 382);
  store.setMarketMode("live");
  assert.equal(store.getSnapshot().state.active.profit, 382); // No evaluation of cached quotes on switch.
  store.receiveMarketQuotes(quotes(60600));
  assert.equal(store.getSnapshot().state.active.profit, 100);
  assert.equal(store.getSnapshot().state.active.entryPrice, 60000);
  store.setMarketMode("demo");
  store.dispatch({ type: "MOVE", mode: "target" });
  assert.equal(store.getSnapshot().state.cash, 10500);
});
test("mode, cached prices and active P&L survive refresh; failures hold last value; reset clears market settings", () => {
  const { store, fresh, storage } = setup();
  store.setMarketMode("live");
  store.receiveMarketQuotes(quotes());
  store.dispatch(buy);
  store.receiveMarketQuotes(quotes(61200));
  const restored = fresh();
  assert.equal(restored.getSnapshot().market.mode, "live");
  assert.equal(restored.getSnapshot().market.quotes.BTC.price, 61200);
  assert.equal(restored.getSnapshot().state.active.profit, 200);
  assert.equal(restored.getSnapshot().marketStatus, "idle");
  restored.setMarketStatus("unavailable");
  assert.equal(restored.getSnapshot().state.active.profit, 200);
  restored.reset();
  assert.equal(storage.getItem(PAPER_TRADING_KEY), null);
  assert.deepEqual(fresh().getSnapshot().market, { mode: "demo", quotes: {} });
});
test("v1 saved positions migrate without losing trades; corrupt cache cannot erase financial state", () => {
  const { store, storage } = setup();
  store.dispatch(buy);
  const data = JSON.parse(storage.getItem(PAPER_TRADING_KEY));
  data.version = 1;
  delete data.market;
  const migrated = decodePaperTrading(JSON.stringify(data));
  assert.equal(migrated.state.active.amount, 10000);
  assert.equal(migrated.market.mode, "demo");
  data.version = 2;
  data.market = {
    mode: "live",
    quotes: {
      BTC: { price: -1, updatedAt: Date.now() },
      ETH: { price: 2400, updatedAt: 1 },
      unknown: { price: 3, updatedAt: 1 },
    },
  };
  const sanitized = decodePaperTrading(JSON.stringify(data));
  assert.equal(sanitized.state.active.amount, 10000);
  assert.equal(sanitized.market.quotes.BTC, undefined);
  assert.equal(sanitized.market.quotes.unknown, undefined);
});
test("Live waits for a valid quote before opening; stale cache cannot create trades", () => {
  const { store } = setup();
  store.setMarketMode("live");
  store.dispatch(buy);
  assert.equal(store.getSnapshot().state.active, null);
  store.receiveMarketQuotes(quotes(60000, Date.now() - MARKET_STALE_MS - 1));
  store.dispatch(buy);
  assert.equal(store.getSnapshot().state.active, null);
});
test("polling unavailable provider reports error and cancelled responses never arrive", async () => {
  const statuses = [];
  const stop = watchMarket(
    {
      name: "offline",
      fetchQuotes: async () => {
        throw Error("offline");
      },
    },
    () => assert.fail("must not deliver"),
    (status) => statuses.push(status),
  );
  await new Promise((resolve) => setImmediate(resolve));
  stop();
  assert.deepEqual(statuses, ["loading", "unavailable"]);
  let resolveRequest,
    delivered = 0;
  const cancel = watchMarket(
    {
      name: "slow",
      fetchQuotes: () => new Promise((resolve) => (resolveRequest = resolve)),
    },
    () => delivered++,
    () => {},
  );
  cancel();
  resolveRequest(quotes());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(delivered, 0);
});
