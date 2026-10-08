import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
const {
  estimatePaperTrade,
  valuePaper,
  openPaper,
  paperReceipt,
  priceForNetProfit,
  percentageTarget,
  PAPER_COSTS,
} = loadTypeScript("src/lib/paper-execution.ts");
const {
  initialDemo,
  demoReducer: reduce,
  ASSETS,
} = loadTypeScript("src/lib/demo-trading.ts");
const { encodePaperTrading, decodePaperTrading, PAPER_TRADING_VERSION } =
  loadTypeScript("src/lib/paper-trading-storage.ts");
const { createPaperTradingStore } = loadTypeScript(
  "src/lib/paper-trading-store.ts",
);
const TradeConfirmation = loadTypeScript(
  "src/components/workspace/TradeConfirmation.tsx",
).default;
const TradeReceipt = loadTypeScript(
  "src/components/workspace/TradeReceipt.tsx",
).default;
const Positions = loadTypeScript(
  "src/components/workspace/Positions.tsx",
).default;
const buy = (patch = {}) => ({
  type: "BUY",
  asset: "BTC",
  amount: 10000,
  target: 500,
  protection: null,
  autoExit: true,
  entryPrice: 63421.2,
  requestId: "receipt-one",
  now: 1000,
  ...patch,
});
const close = (action = { type: "MOVE", mode: "target" }, patch = {}) =>
  reduce(reduce(initialDemo(), buy(patch)), action);
const fresh = () => {
  const data = new Map();
  const storage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
  const store = createPaperTradingStore(() => storage);
  store.hydrate();
  return store;
};
const quotes = (price, time = Date.now()) => ({
  BTC: { price, updatedAt: time },
  ETH: { price: 2500, updatedAt: time },
  SOL: { price: 150, updatedAt: time },
});

test("pre-trade estimates match actual entry and exit assumptions without opening a position", () => {
  const estimate = estimatePaperTrade(10000, 63421.2, 500);
  const s = reduce(initialDemo(), buy());
  const fill = s.active.execution;
  assert.equal(
    estimate.execution.entry.executionPrice,
    fill.entry.executionPrice,
  );
  assert.equal(estimate.execution.entry.fee, 60);
  assert.equal(estimate.execution.entry.quantity, fill.entry.quantity);
  assert.deepEqual(estimate.opening, valuePaper(10000, fill));
  assert.equal(estimate.atTarget.netProfit, 500);
  assert.equal(estimate.atTarget.proceeds, 10500);
  assert.equal(estimate.entryPriceImpact, 10);
  assert.equal(
    estimate.targetExitPriceImpact,
    estimate.atTarget.grossMarketValue - estimate.atTarget.exitNotional,
  );
  assert.equal(estimate.targetNetReturn, 5);
  assert.throws(() => estimatePaperTrade(10000, 63421.2, NaN));
  assert.throws(() => estimatePaperTrade(10000, NaN, 500));
});

test("break-even and euro/percentage target prices share exact conservative cent rounding", () => {
  for (const asset of Object.keys(ASSETS))
    for (const amount of [100, 101, 5000, 10000, 25001, 1000000]) {
      for (const target of [
        1,
        100,
        200,
        500,
        percentageTarget(amount, 1),
        percentageTarget(amount, 2),
      ]) {
        const e = estimatePaperTrade(amount, ASSETS[asset].price, target);
        assert.equal(
          valuePaper(amount, e.execution, e.breakEvenPrice).netProfit,
          0,
        );
        assert.equal(e.atTarget.netProfit, target);
        assert.equal(e.atTarget.proceeds, amount + target);
        assert.ok(e.breakEvenPrice > ASSETS[asset].price);
        assert.equal(
          valuePaper(amount, e.execution, e.targetPrice * (1 - 1e-6))
            .netProfit < target,
          true,
        );
      }
    }
});

test("custom cost assumptions remain snapshotted in estimates and receipts", () => {
  const costs = {
    ...PAPER_COSTS,
    entryFeeBps: 80,
    exitFeeBps: 100,
    spreadBps: 25,
    slippageBps: 7,
  };
  const e = estimatePaperTrade(10000, 100, 500, costs);
  costs.spreadBps = 999;
  assert.equal(e.execution.costs.spreadBps, 25);
  const s = close(undefined, { costs: e.execution.costs, entryPrice: 100 });
  const r = paperReceipt(10000, s.lastClosed.execution);
  assert.equal(r.entryFee, 80);
  assert.equal(r.exitFee, e.atTarget.exitFee);
  assert.equal(r.spreadBps, 25);
  assert.equal(r.slippageBps, 7);
});

test("automatic target, protection and manual closes each produce one fixed receipt", () => {
  for (const [action, patch, reason, profit] of [
    [{ type: "MOVE", mode: "target" }, {}, "target", 500],
    [{ type: "MOVE", mode: "fall" }, { protection: 200 }, "protection", -200],
    [{ type: "SELL" }, {}, "manual", -140],
  ]) {
    const s = close(action, patch),
      p = s.lastClosed,
      r = paperReceipt(p.amount, p.execution);
    assert.equal(p.reason, reason);
    assert.equal(r.id, "QE-receipt-one");
    assert.equal(r.openedAt, 1000);
    assert.ok(r.closedAt >= r.openedAt);
    assert.equal(r.netProfit, profit);
    assert.ok(Math.abs(r.netReturn - profit / 100) < 1e-12);
    assert.equal(r.proceeds, s.cash);
    assert.equal(r.grossProceeds - r.exitFee, r.proceeds);
    assert.equal(r.grossProfit - r.totalCosts, r.netProfit);
    assert.equal(
      r.totalCosts,
      r.entryFee + r.exitFee + r.entryPriceImpact + r.exitPriceImpact,
    );
    assert.equal(s.completed.filter((p) => !p.example).length, 1);
    for (const event of [
      { type: "SELL" },
      { type: "MOVE", mode: "target" },
      { type: "MARKET_PRICE", price: 1e6 },
      buy(),
    ])
      assert.equal(reduce(s, event), s);
    assert.equal(Object.isFrozen(r), true);
    assert.equal(Object.isFrozen(p), true);
    for (const v of [
      p.execution,
      p.execution.entry,
      p.execution.costs,
      p.execution.exit,
    ])
      assert.ok(Object.isFrozen(v));
    assert.throws(() => {
      p.execution.exit.netProfit = 9000;
    }, TypeError);
    assert.throws(() => {
      p.execution.entry.quantity = 9;
    }, TypeError);
  }
});

test("new market quotes, next trades and transfers cannot alter historical receipts", () => {
  const s = close(),
    original = paperReceipt(10000, s.lastClosed.execution);
  let later = reduce(s, { type: "TRANSFER" });
  later = reduce(
    later,
    buy({ requestId: "receipt-two", asset: "ETH", entryPrice: 2500 }),
  );
  later = reduce(later, { type: "MARKET_PRICE", price: 4000 });
  assert.deepEqual(
    paperReceipt(
      10000,
      later.completed.find((p) => p.asset === "BTC").execution,
    ),
    original,
  );
  assert.notEqual(
    paperReceipt(10000, later.lastClosed.execution).id,
    original.id,
  );
  assert.equal(paperReceipt(10000, openPaper(10000, 100, 1000, "open")), null);
});

test("v3 refresh and cloud-compatible restoration preserve receipt values and immutability", () => {
  const s = close();
  const raw = encodePaperTrading({ asset: "BTC", state: s });
  assert.equal(JSON.parse(raw).version, PAPER_TRADING_VERSION);
  assert.equal(PAPER_TRADING_VERSION, 3);
  const restored = decodePaperTrading(raw);
  assert.ok(restored);
  const old = paperReceipt(10000, s.lastClosed.execution);
  const current = paperReceipt(10000, restored.state.lastClosed.execution);
  assert.deepEqual(current, old);
  assert.deepEqual(restored.state.completed[0], s.completed[0]);
  assert.ok(Object.isFrozen(restored.state.completed[0]));
  assert.ok(Object.isFrozen(restored.state.completed[0].execution.exit));
  assert.deepEqual(JSON.parse(encodePaperTrading(restored)), JSON.parse(raw));
});

test("legacy v1/v2 history remains cost-free and does not fabricate receipts or dates", () => {
  for (const version of [1, 2]) {
    const old = JSON.parse(
      encodePaperTrading({ asset: "BTC", state: close() }),
    );
    old.version = version;
    for (const p of [old.state.lastClosed, ...old.state.completed]) {
      delete p.execution;
      delete p.exitPrice;
    }
    const restored = decodePaperTrading(JSON.stringify(old));
    assert.ok(restored);
    const p = restored.state.completed[0];
    assert.equal(p.profit, 500);
    assert.equal(p.legacy, true);
    assert.equal(p.execution, undefined);
    assert.equal(restored.state.cash, 10500);
    const html = renderToStaticMarkup(
      createElement(TradeReceipt, { position: p }),
    );
    assert.match(html, /Legacy cost-free paper trade/);
    assert.match(html, /have not been reconstructed/);
    assert.doesNotMatch(html, /Realized net return/);
  }
});

test("Live confirmation cannot override quotes; changed quote or mode requires reconfirmation", () => {
  const s = fresh();
  s.setMarketMode("live");
  s.receiveMarketQuotes(quotes(60000));
  const command = buy({
    expectedQuote: 60000,
    expectedMarketMode: "live",
    entryPrice: 100,
  });
  s.receiveMarketQuotes(quotes(61000));
  s.dispatch(command);
  assert.equal(s.getSnapshot().state.active, null);
  assert.match(s.getSnapshot().state.announcement, /Market quote changed/);
  const events = s.getSnapshot().state.events;
  s.dispatch({ ...command, expectedQuote: 61000 });
  assert.equal(s.getSnapshot().state.active.entryPrice, 61000);
  assert.equal(s.getSnapshot().state.events.length, events.length + 2);
  const x = s.getSnapshot().state.active.execution;
  const target = priceForNetProfit(10000, x, 500);
  s.receiveMarketQuotes(quotes(target));
  assert.equal(s.getSnapshot().state.lastClosed.profit, 500);
  const receipt = paperReceipt(
    10000,
    s.getSnapshot().state.lastClosed.execution,
  );
  s.receiveMarketQuotes(quotes(99000));
  assert.deepEqual(
    paperReceipt(10000, s.getSnapshot().state.lastClosed.execution),
    receipt,
  );
  s.dispatch({ type: "NEW_TRADE" });
  s.setMarketMode("demo");
  s.dispatch({ ...command, requestId: "new", expectedQuote: ASSETS.BTC.price });
  assert.equal(s.getSnapshot().state.active, null);
  s.dispatch({
    ...command,
    requestId: "new",
    expectedQuote: ASSETS.BTC.price,
    expectedMarketMode: "demo",
  });
  assert.equal(s.getSnapshot().state.active.entryPrice, ASSETS.BTC.price);
  s.dispatch({ type: "MOVE", mode: "target" });
  assert.equal(s.getSnapshot().state.cash, 21000);
});

test("confirmation/receipt consumer views disclose estimates versus realized paper values", () => {
  const html = renderToStaticMarkup(
    createElement(TradeConfirmation, {
      asset: "BTC",
      amount: 10000,
      target: 500,
      targetLabel: "+€5.00",
      protection: null,
      autoExit: true,
      price: 63421.2,
      disabled: false,
      live: false,
      onConfirm() {},
      onBack() {},
    }),
  );
  for (const label of [
    "Confirm Paper Trade",
    "Go Back",
    "Estimated before execution",
    "Break-even market price",
    "No real money",
    "Estimated future exit fee at target",
  ])
    assert.ok(html.includes(label));
  const receipt = renderToStaticMarkup(
    createElement(TradeReceipt, { position: close().lastClosed }),
  );
  for (const label of [
    "QE-receipt-one",
    "Profit target",
    "Realized after execution",
    "Final simulated proceeds",
    "€105.00",
  ])
    assert.ok(receipt.includes(label));
});

test("completed history sorts by closing timestamp and uses stacked mobile cards", () => {
  const first = close().lastClosed;
  const later = {
    ...first,
    id: 10,
    execution: {
      ...first.execution,
      entry: { ...first.execution.entry, requestId: "receipt-two" },
      exit: {
        ...first.execution.exit,
        closedAt: first.execution.exit.closedAt + 1000,
      },
    },
  };
  const input = [first, ...initialDemo().completed, later];
  const html = renderToStaticMarkup(
    createElement(Positions, {
      active: null,
      completed: input,
      onMonitor() {},
    }),
  );
  assert.ok(
    html.indexOf('data-receipt-id="10"') <
      html.indexOf(`data-receipt-id="${first.id}"`),
  );
  assert.match(html, /qw-mobile-positions/);
  assert.match(html, /Realized net P&amp;L/);
  assert.deepEqual(
    input.map((p) => p.id),
    [first.id, -1, -2, -3, 10],
  );
});

test("small investments preserve non-zero quantity display and zero-cost precision", () => {
  const { cryptoQuantity } = loadTypeScript("src/lib/demo-trading.ts");
  const s = close(
    { type: "SELL" },
    { amount: 100, entryPrice: 1e9, target: 1 },
  );
  const r = paperReceipt(100, s.lastClosed.execution);
  assert.ok(r.quantity > 0 && r.quantity < 1e-8);
  assert.ok(Number(cryptoQuantity(r.quantity)) > 0);
  const html = renderToStaticMarkup(
    createElement(TradeReceipt, { position: s.lastClosed }),
  );
  assert.ok(html.includes(cryptoQuantity(r.quantity)));
  const costs = { entryFeeBps: 0, exitFeeBps: 0, spreadBps: 0, slippageBps: 0 };
  const e = estimatePaperTrade(101, 0.000001, 1, costs);
  assert.equal(e.execution.entry.fee, 0);
  assert.equal(valuePaper(101, e.execution, e.breakEvenPrice).netProfit, 0);
  assert.equal(e.atTarget.netProfit, 1);
  assert.equal(e.atTarget.exitFee, 0);
});
