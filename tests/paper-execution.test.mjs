import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const {
  openPaper,
  valuePaper,
  priceForNetProfit,
  percentageTarget,
  PAPER_COSTS,
} = loadTypeScript("src/lib/paper-execution.ts");
const {
  initialDemo,
  demoReducer: reduce,
  currentPrice,
} = loadTypeScript("src/lib/demo-trading.ts");
const { createPaperTradingStore } = loadTypeScript(
  "src/lib/paper-trading-store.ts",
);
const {
  decodePaperTrading,
  PAPER_TRADING_KEY: KEY,
  PAPER_TRADING_VERSION: VERSION,
} = loadTypeScript("src/lib/paper-trading-storage.ts");
const order = (patch = {}) => ({
  type: "BUY",
  asset: "BTC",
  amount: 10000,
  target: 500,
  protection: null,
  autoExit: true,
  entryPrice: 60000,
  now: 1000,
  requestId: "test-order",
  ...patch,
});
const quotes = (price) => ({
  BTC: { price, updatedAt: Date.now() },
  ETH: { price: 2400, updatedAt: Date.now() },
  SOL: { price: 100, updatedAt: Date.now() },
});
function setup() {
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  const fresh = () => {
    const s = createPaperTradingStore(() => storage);
    s.hydrate();
    return s;
  };
  return { storage, fresh, store: fresh() };
}
const almost = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
test("entry fills debit the fee once from the full budget and acquire a fixed quantity", () => {
  const x = openPaper(10000, 60000, 1000, "entry");
  assert.equal(x.entry.fee, 60);
  assert.equal(x.entry.quotedPrice, 60000);
  almost(x.entry.executionPrice, 60060);
  almost(x.entry.quantity, 99.4 / 60060);
  assert.equal(x.entry.openedAt, 1000);
  assert.equal(x.entry.requestId, "entry");
  assert.deepEqual(x.costs, PAPER_COSTS);
  assert.notEqual(x.costs, PAPER_COSTS);
  const y = openPaper(101, 100, 1000, "rounding");
  assert.equal(y.entry.fee, 1);
});
test("exit fee, spread/slippage and gross/net reconciliation match independently calculated cents", () => {
  const x = openPaper(10000, 60000, 1000, "costs");
  const v = valuePaper(10000, x, 60000);
  almost(v.exitExecutionPrice, 59940);
  assert.equal(v.grossMarketValue, 9930);
  assert.equal(v.exitNotional, 9920);
  assert.equal(v.exitFee, 60);
  assert.equal(v.proceeds, 9860);
  assert.equal(v.entryCost, 70);
  assert.equal(v.exitCost, 70);
  assert.equal(v.grossProfit, 0);
  assert.equal(v.netProfit, -140);
  assert.equal(v.grossProfit - v.entryCost - v.exitCost, v.netProfit);
  const profit = valuePaper(10000, x, 61200);
  assert.equal(profit.grossProfit, 198);
  assert.equal(profit.exitFee, 61);
  assert.equal(profit.netProfit, 57);
});
test("entry, exit, spread and slippage assumptions are separately configurable and snapshotted", () => {
  for (const key of Object.keys(PAPER_COSTS)) {
    const costs = {
      entryFeeBps: 0,
      exitFeeBps: 0,
      spreadBps: 0,
      slippageBps: 0,
      [key]: 100,
    };
    const x = openPaper(10000, 100, 1000, key, costs);
    const v = valuePaper(10000, x);
    assert.ok(v.netProfit < 0);
    if (key === "entryFeeBps") {
      assert.equal(x.entry.fee, 100);
      assert.equal(v.netProfit, -100);
    }
    if (key === "exitFeeBps") {
      assert.equal(v.exitFee, 100);
      assert.equal(v.netProfit, -100);
    }
    if (key === "spreadBps") {
      almost(x.entry.executionPrice, 100.5);
      almost(v.exitExecutionPrice, 99.5);
    }
    if (key === "slippageBps") {
      almost(x.entry.executionPrice, 101);
      almost(v.exitExecutionPrice, 99);
    }
    costs[key] = 0;
    assert.equal(x.costs[key], 100);
  }
  for (const costs of [
    { ...PAPER_COSTS, entryFeeBps: -1 },
    { ...PAPER_COSTS, exitFeeBps: NaN },
    { ...PAPER_COSTS, spreadBps: 0.1 },
    { ...PAPER_COSTS, slippageBps: 10001 },
  ])
    assert.throws(() => openPaper(10000, 100, 1000, "bad", costs));
});
test("euro and percentage net targets invert the exact same rounded valuation", () => {
  for (const amount of [100, 5000, 10000, 25000, 1000000])
    for (const target of [
      1,
      100,
      200,
      500,
      percentageTarget(amount, 1),
      percentageTarget(amount, 2),
    ]) {
      const x = openPaper(amount, 63421.2, 1000, "target");
      const price = priceForNetProfit(amount, x, target);
      const v = valuePaper(amount, x, price);
      assert.equal(v.netProfit, target);
      assert.equal(v.proceeds, amount + target);
      assert.ok(price > 63421.2);
    }
  assert.equal(percentageTarget(10000, 2), 200);
  assert.equal(percentageTarget(25000, 1), 250);
  const x = openPaper(10000, 60000, 1000, "five");
  const target = priceForNetProfit(10000, x, 500);
  assert.ok(target > 63000);
  assert.equal(valuePaper(10000, x, 63000).netProfit, 353);
  assert.equal(valuePaper(10000, x, target).netProfit, 500);
});
test("deterministic Reach target generates a net-paying quote instead of overwriting profit", () => {
  let s = reduce(initialDemo(), order());
  assert.equal(s.active.profit, -140);
  s = reduce(s, { type: "MOVE", mode: "rise" });
  assert.equal(s.active.profit, 382);
  assert.equal(valuePaper(10000, s.active.execution).netProfit, 382);
  s = reduce(s, { type: "MOVE", mode: "target" });
  const p = s.lastClosed;
  assert.equal(p.profit, 500);
  assert.equal(s.cash, 1000500);
  assert.ok(currentPrice(p) > 63000);
  assert.equal(p.execution.exit.netProfit, 500);
  assert.equal(p.execution.exit.proceeds, 10500);
  assert.equal(p.execution.entry.fee, 60);
});
test("Live quotes use net P&L, require the cost-adjusted target and preserve market overshoots", () => {
  const { store } = setup();
  store.setMarketMode("live");
  store.receiveMarketQuotes(quotes(60000));
  store.dispatch(order());
  const entry = store.getSnapshot().state.active.execution.entry;
  store.receiveMarketQuotes(quotes(63000));
  assert.equal(store.getSnapshot().state.active.profit, 353);
  assert.deepEqual(store.getSnapshot().state.active.execution.entry, entry);
  store.receiveMarketQuotes(quotes(64200));
  const s = store.getSnapshot().state;
  assert.equal(s.active, null);
  assert.equal(s.lastClosed.exitPrice, 64200);
  assert.equal(s.lastClosed.profit, 550);
  assert.equal(s.cash, 1000550);
  assert.equal(s.lastClosed.execution.exit.exitFee, 64);
  assert.equal(s.lastClosed.execution.exit.proceeds + 990000, s.cash);
});
test("protection uses net loss and observed Live prices, without guaranteeing the loss threshold", () => {
  let s = reduce(initialDemo(), order({ protection: 200 }));
  s = reduce(s, { type: "MARKET_PRICE", price: 59400 });
  assert.equal(s.active, null);
  assert.equal(s.lastClosed.reason, "protection");
  assert.equal(s.lastClosed.profit, -239);
  assert.equal(s.cash, 999761);
  const demo = reduce(reduce(initialDemo(), order({ protection: 200 })), {
    type: "MOVE",
    mode: "fall",
  });
  assert.equal(demo.lastClosed.profit, -200);
  assert.equal(demo.cash, 999800);
  assert.equal(valuePaper(10000, demo.lastClosed.execution).netProfit, -200);
  const immediate = reduce(initialDemo(), order({ protection: 100 }));
  assert.equal(immediate.lastClosed.profit, -140);
  assert.equal(immediate.cash, 999860);
});
test("manual sale settles net proceeds once; lowering a target sells at the existing quote", () => {
  let s = reduce(initialDemo(), order());
  s = reduce(s, { type: "MARKET_PRICE", price: 61200 });
  s = reduce(s, { type: "SELL" });
  assert.equal(s.lastClosed.profit, 57);
  assert.equal(s.cash, 1000057);
  assert.equal(s.lastClosed.execution.exit.exitFee, 61);
  assert.equal(reduce(s, { type: "SELL" }), s);
  let edit = reduce(reduce(initialDemo(), order()), {
    type: "MOVE",
    mode: "rise",
  });
  const price = currentPrice(edit.active);
  edit = reduce(edit, { type: "EDIT_TARGET", target: 300 });
  assert.equal(edit.cash, 1000382);
  assert.equal(currentPrice(edit.lastClosed), price);
});
test("target events, sale retries, duplicate order IDs and stale callbacks cannot duplicate proceeds or activity", () => {
  let s = reduce(reduce(initialDemo(), order()), {
    type: "MOVE",
    mode: "target",
  });
  const before = structuredClone(s);
  for (const action of [
    { type: "MARKET_PRICE", price: 70000 },
    { type: "MOVE", mode: "target" },
    { type: "SELL" },
    order(),
  ])
    assert.equal(reduce(s, action), s);
  assert.deepEqual(s, before);
  const closedId = s.lastClosed.id;
  s = reduce(s, order({ requestId: "next-order" }));
  const active = s.active;
  assert.equal(reduce(s, { type: "SELL", positionId: closedId }), s);
  assert.equal(
    reduce(s, { type: "MOVE", mode: "target", positionId: closedId }),
    s,
  );
  assert.equal(s.active, active);
});
test("refresh preserves fixed fill inputs, closed receipt, fees, cash and transfer idempotency", () => {
  const { storage, fresh, store } = setup();
  store.dispatch(order());
  const first = store.getSnapshot().state.active;
  let next = fresh();
  assert.deepEqual(next.getSnapshot().state.active, first);
  assert.equal(JSON.parse(storage.getItem(KEY)).version, VERSION);
  next.dispatch({ type: "MOVE", mode: "target" });
  const closed = next.getSnapshot().state;
  next = fresh();
  assert.deepEqual(next.getSnapshot().state.completed, closed.completed);
  assert.equal(next.getSnapshot().state.cash, 1000500);
  const history = next.getSnapshot().state.events;
  next.dispatch({ type: "SELL" });
  next.dispatch({ type: "MOVE", mode: "target" });
  assert.deepEqual(next.getSnapshot().state.events, history);
  const sequence = next.getSnapshot().state.sequence;
  next.dispatch({ type: "TRANSFER", expectedSequence: sequence });
  next = fresh();
  assert.equal(next.getSnapshot().state.cash, 0);
  assert.equal(next.getSnapshot().state.sent, 1000500);
  const sent = next.getSnapshot().state;
  next.dispatch({ type: "TRANSFER", expectedSequence: sequence });
  assert.equal(next.getSnapshot().state, sent);
  next.dispatch(order({ requestId: "later" }));
  next.dispatch({ type: "MOVE", mode: "target" });
  next.dispatch({ type: "TRANSFER", expectedSequence: sequence });
  assert.equal(next.getSnapshot().state.cash, 0);
  assert.equal(next.getSnapshot().state.active, null); // No new trade after sending all virtual cash.
});
test("restoration rejects changed quantities, fees, assumptions, valuations and receipts", () => {
  const { store, storage } = setup();
  store.dispatch(order());
  const active = JSON.parse(storage.getItem(KEY));
  for (const mutate of [
    (p) => p.execution.entry.fee++,
    (p) => (p.execution.entry.quantity *= 2),
    (p) => p.execution.costs.exitFeeBps++,
    (p) => p.execution.entry.executionPrice++,
    (p) => (p.execution.entry.openedAt = -1),
    (p) => (p.profit = 0),
    (p) => delete p.execution,
  ]) {
    const data = structuredClone(active);
    mutate(data.state.active);
    assert.equal(decodePaperTrading(JSON.stringify(data)), null);
  }
  store.dispatch({ type: "MOVE", mode: "target" });
  const closed = JSON.parse(storage.getItem(KEY));
  for (const key of [
    "exitFee",
    "proceeds",
    "grossProfit",
    "netProfit",
    "exitExecutionPrice",
  ]) {
    const data = structuredClone(closed);
    data.state.completed[0].execution.exit[key]++;
    assert.equal(decodePaperTrading(JSON.stringify(data)), null);
  }
});
test("v1 and v2 migrate active/closed cost-free trades without charging fees or replaying sales", () => {
  const { store, storage, fresh } = setup();
  store.dispatch(
    order({
      costs: { entryFeeBps: 0, exitFeeBps: 0, spreadBps: 0, slippageBps: 0 },
    }),
  );
  for (const version of [1, 2]) {
    const old = JSON.parse(storage.getItem(KEY));
    old.version = version;
    delete old.state.active.execution;
    old.state.active.profit = 200;
    storage.setItem(KEY, JSON.stringify(old));
    const migrated = fresh();
    assert.equal(migrated.getSnapshot().state.active.profit, 200);
    assert.equal(migrated.getSnapshot().state.active.execution, undefined);
    assert.equal(migrated.getSnapshot().state.active.legacy, true);
    migrated.dispatch({ type: "SELL" });
    assert.equal(migrated.getSnapshot().state.cash, 1000200);
    assert.equal(fresh().getSnapshot().state.cash, 1000200);
    // Seed the next legacy fixture afresh.
    store.reset();
    store.dispatch(
      order({
        costs: { entryFeeBps: 0, exitFeeBps: 0, spreadBps: 0, slippageBps: 0 },
      }),
    );
  }
});
