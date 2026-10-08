import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const source = fileURLToPath(
  new URL("../src/lib/demo-trading.ts", import.meta.url),
);
const compiled = ts.transpileModule(fs.readFileSync(source, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const model = new Module(source);
model._compile(compiled, source);
const {
  initialDemo,
  demoReducer: reduce,
  progress,
  currentPrice,
} = model.exports;
const buy = (overrides = {}) => ({
  type: "BUY",
  asset: "BTC",
  amount: 10000,
  target: 500,
  protection: null,
  autoExit: true,
  ...overrides,
});

test("default trade rises to €3.82 / 76%, closes at target, then sends €105 home", () => {
  let state = reduce(initialDemo(), buy());
  state = reduce(state, { type: "MOVE", mode: "rise" });
  assert.equal(state.active.profit, 382);
  assert.equal(progress(state.active), 76);
  assert.ok(currentPrice(state.active) > state.active.entryPrice);
  state = reduce(state, { type: "MOVE", mode: "target" });
  assert.equal(state.active, null);
  assert.equal(state.lastClosed.reason, "target");
  assert.equal(state.lastClosed.profit, 500);
  assert.equal(state.cash, 10500);
  assert.match(state.events[0].text, /sold automatically/);
  state = reduce(state, { type: "TRANSFER" });
  assert.equal(state.cash, 0);
  assert.equal(state.sent, 10500);
  assert.equal(state.lastTransfer, 10500);
  assert.match(state.events[0].text, /€105.00 sent to bank/);
  assert.equal(reduce(state, { type: "TRANSFER" }), state);
});
test("protection closes a falling position at the chosen loss and preserves proceeds", () => {
  const state = reduce(reduce(initialDemo(), buy({ protection: 200 })), {
    type: "MOVE",
    mode: "fall",
  });
  assert.equal(state.active, null);
  assert.equal(state.lastClosed.reason, "protection");
  assert.equal(state.lastClosed.profit, -200);
  assert.equal(state.cash, 9800);
  assert.equal(reduce(state, { type: "SELL" }), state);
});
test("manual mode reaches target without automatically selling; protection still applies", () => {
  let state = reduce(initialDemo(), buy({ autoExit: false, protection: 200 }));
  state = reduce(state, { type: "MOVE", mode: "target" });
  assert.equal(state.active.profit, 500);
  assert.equal(state.cash, 0);
  const manual = reduce(state, { type: "SELL" });
  assert.equal(manual.lastClosed.reason, "manual");
  assert.equal(manual.cash, 10500);
  for (let i = 0; i < 4; i++)
    state = reduce(state, { type: "MOVE", mode: "fall" });
  assert.equal(state.lastClosed.reason, "protection");
});
test("editing a target evaluates the current position immediately", () => {
  let state = reduce(reduce(initialDemo(), buy()), {
    type: "MOVE",
    mode: "rise",
  });
  state = reduce(state, { type: "EDIT_TARGET", target: 300 });
  assert.equal(state.active, null);
  assert.equal(state.cash, 10300);
  assert.equal(state.lastClosed.target, 300);
});
test("multiple trade cycles conserve money and exclude sample history", () => {
  let state = initialDemo();
  assert.equal(state.cash, 0);
  assert.equal(state.completed.length, 3);
  state = reduce(state, buy({ asset: "ETH", amount: 25000, target: 500 }));
  assert.equal(reduce(state, buy()), state);
  state = reduce(state, { type: "MOVE", mode: "target" });
  state = reduce(state, { type: "NEW_TRADE" });
  state = reduce(
    state,
    buy({ asset: "SOL", amount: 5000, target: 100, protection: 100 }),
  );
  for (let i = 0; i < 3; i++)
    state = reduce(state, { type: "MOVE", mode: "fall" });
  assert.equal(state.cash, 30400);
  assert.equal(state.completed.filter((p) => !p.example).length, 2);
  state = reduce(state, { type: "TRANSFER" });
  assert.equal(state.sent, 30400);
  assert.equal(state.cash, 0);
});
test("paused ticks stay fixed, invalid inputs are rejected, and losses cannot create negative cash", () => {
  const initial = initialDemo();
  for (const bad of [
    buy({ amount: NaN }),
    buy({ amount: 0 }),
    buy({ target: Infinity }),
    buy({ protection: 10000 }),
  ])
    assert.equal(reduce(initial, bad), initial);
  let state = reduce(initial, buy({ amount: 100, target: 1000000 }));
  state = reduce(state, { type: "PLAY", value: false });
  assert.equal(reduce(state, { type: "MOVE", mode: "tick" }), state);
  state = reduce(state, { type: "MOVE", mode: "fall" });
  assert.equal(state.active.profit, -99);
  state = reduce(state, { type: "SELL" });
  assert.equal(state.cash, 1);
  state = reduce(state, { type: "RESET" });
  assert.equal(state.cash, 0);
  assert.equal(state.active, null);
  assert.equal(state.completed.filter((p) => !p.example).length, 0);
});
