import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const {
  initialDemo,
  demoReducer: reduce,
  portfolioSummary,
} = loadTypeScript("src/lib/demo-trading.ts");
const {
  encodePaperTrading,
  decodePaperTrading,
  PAPER_TRADING_KEY: KEY,
} = loadTypeScript("src/lib/paper-trading-storage.ts");
const { createPaperTradingStore } = loadTypeScript(
  "src/lib/paper-trading-store.ts",
);
const buy = {
  type: "BUY",
  asset: "BTC",
  amount: 10000,
  target: 500,
  protection: null,
  autoExit: true,
  requestId: "portfolio-test",
};
const roundTrip = (state) =>
  decodePaperTrading(encodePaperTrading({ asset: "BTC", state })).state;
test("fresh portfolio has €10,000 and examples never contribute to returns", () => {
  assert.deepEqual(portfolioSummary(initialDemo()), {
    cash: 1000000,
    invested: 0,
    value: 1000000,
    realized: 0,
    unrealized: 0,
    netProfit: 0,
  });
});
test("purchase deducts the full budget once, including entry cost; net valuation uses the engine", () => {
  const s = reduce(initialDemo(), buy);
  const summary = portfolioSummary(s);
  assert.equal(s.cash, 990000);
  assert.equal(summary.invested, 10000);
  assert.equal(summary.unrealized, -140);
  assert.equal(summary.value, 999860);
  assert.equal(reduce(s, buy), s);
  assert.deepEqual(portfolioSummary(roundTrip(s)), summary);
});
test("target close returns net proceeds once and conserves portfolio capital across refresh", () => {
  let s = reduce(initialDemo(), buy);
  s = reduce(s, { type: "MOVE", mode: "target" });
  assert.equal(s.cash, 1000500);
  assert.equal(s.lastClosed.execution.exit.proceeds, 10500);
  assert.deepEqual(portfolioSummary(s), {
    cash: 1000500,
    invested: 0,
    value: 1000500,
    realized: 500,
    unrealized: 0,
    netProfit: 500,
  });
  const receipt = structuredClone(s.lastClosed);
  s = roundTrip(s);
  assert.deepEqual(s.lastClosed, receipt);
  assert.equal(reduce(s, { type: "SELL" }), s);
  s = reduce(s, { ...buy, requestId: "second", amount: 25000 });
  assert.equal(s.cash, 975500);
  assert.equal(s.active.amount, 25000);
  assert.ok(roundTrip(s));
});
test("insufficient cash, invalid and minimum budgets cannot create free funds", () => {
  const s = initialDemo();
  for (const amount of [1000001, NaN, Infinity, -100, 99])
    assert.equal(reduce(s, { ...buy, amount }), s);
  const small = reduce(s, { ...buy, amount: 100 });
  assert.equal(small.cash, 999900);
  const all = reduce(s, { ...buy, amount: 1000000 });
  assert.equal(all.cash, 0);
  const sold = reduce(all, { type: "SELL" });
  assert.ok(sold.cash >= 0);
  assert.equal(
    reduce(sold, { ...buy, requestId: "too-large", amount: 1000000 }),
    sold,
  );
});
test("protection and manual sales return after-cost proceeds without charging twice", () => {
  for (const [action, protection, expected] of [
    [{ type: "MOVE", mode: "fall" }, 200, 999800],
    [{ type: "SELL" }, null, 999860],
  ]) {
    const s = reduce(reduce(initialDemo(), { ...buy, protection }), action);
    assert.equal(s.cash, expected);
    assert.equal(reduce(s, { type: "SELL" }), s);
    assert.ok(roundTrip(s));
  }
});
test("virtual send-home and reset preserve accounting and start a fresh €10,000 portfolio", () => {
  let s = reduce(reduce(initialDemo(), buy), { type: "MOVE", mode: "target" });
  s = reduce(s, { type: "TRANSFER" });
  assert.equal(s.sent, 1000500);
  assert.equal(s.cash, 0);
  s = roundTrip(s);
  assert.equal(reduce(s, { ...buy, requestId: "empty" }), s);
  const reset = reduce(s, { type: "RESET" });
  assert.equal(reset.cash, 1000000);
  assert.equal(reset.sent, 0);
  assert.equal(reset.active, null);
  assert.equal(reset.completed.filter((p) => !p.example).length, 0);
});
test("pre-portfolio snapshots preserve balances and receipts without a silent €10,000 grant", () => {
  let s = reduce(reduce(initialDemo(), buy), { type: "MOVE", mode: "target" });
  const old = JSON.parse(encodePaperTrading({ asset: "BTC", state: s }));
  delete old.state.portfolioCapital;
  old.state.cash = 10500;
  const restored = decodePaperTrading(JSON.stringify(old));
  assert.equal(restored.state.cash, 10500);
  assert.equal(restored.state.portfolioCapital, undefined);
  assert.deepEqual(restored.state.completed, s.completed);
  const next = reduce(restored.state, {
    ...buy,
    amount: 5000,
    requestId: "legacy-next",
  });
  assert.equal(next.cash, 5500);
  assert.equal(next.portfolioCapital, 10000);
  assert.ok(roundTrip(next));
  old.state.cash = 1;
  assert.equal(decodePaperTrading(JSON.stringify(old)), null);
});
test("tampered funding or balance is rejected and unreadable saved data is backed up before recovery", () => {
  const valid = JSON.parse(
    encodePaperTrading({ asset: "BTC", state: initialDemo() }),
  );
  for (const capital of [-1, NaN, 1000001]) {
    const data = structuredClone(valid);
    data.state.portfolioCapital = capital;
    assert.equal(decodePaperTrading(JSON.stringify(data)), null);
  }
  const map = new Map([[KEY, "{unreadable"]]);
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
  const store = createPaperTradingStore(() => storage);
  store.hydrate();
  assert.equal(store.getSnapshot().state.cash, 1000000);
  assert.ok(
    [...map.entries()].some(
      ([k, v]) => k.startsWith(`${KEY}.recovery.`) && v === "{unreadable",
    ),
  );
  store.dispatch(buy);
  const other = createPaperTradingStore(() => storage);
  other.hydrate();
  assert.equal(other.getSnapshot().state.cash, 990000);
  assert.equal(other.getSnapshot().state.active.amount, 10000);
  other.reset();
  assert.equal(other.getSnapshot().state.cash, 1000000);
  const third = createPaperTradingStore(() => storage);
  third.hydrate();
  assert.equal(third.getSnapshot().state.cash, 1000000);
});
test("failed recovery backup never overwrites the original even after a paper action", () => {
  const map = new Map([[KEY, "{broken"]]);
  const storage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      if (k.includes(".recovery.")) throw Error("quota");
      map.set(k, v);
    },
    removeItem: (k) => map.delete(k),
  };
  const store = createPaperTradingStore(() => storage);
  store.hydrate();
  store.dispatch(buy);
  assert.equal(map.get(KEY), "{broken");
  assert.equal(store.getSnapshot().storageStatus, "unavailable");
});

test("unsafe cash and overflowing settlements cannot corrupt the portfolio", () => {
  for (const cash of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1]) {
    const s = { ...initialDemo(), cash };
    assert.equal(reduce(s, buy), s);
  }
  const opened = reduce(initialDemo(), buy);
  const full = { ...opened, cash: Number.MAX_SAFE_INTEGER - 100 };
  assert.equal(reduce(full, { type: "SELL" }), full);
});
