import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTypeScript } from './load-typescript.mjs';
const { initialDemo, demoReducer, portfolioSummary } = loadTypeScript('src/lib/demo-trading.ts');
const { performanceStatistics, realizedHistory, filterHistory } = loadTypeScript('src/lib/portfolio-performance.ts');
const { encodePaperTrading, decodePaperTrading } = loadTypeScript('src/lib/paper-trading-storage.ts');
const { createPaperTradingStore } = loadTypeScript('src/lib/paper-trading-store.ts');
const buy = { type: 'BUY', asset: 'ETH', amount: 10000, target: 500, protection: null, autoExit: false, now: 1000 };
const roundTrip = state => decodePaperTrading(encodePaperTrading({ asset: 'ETH', state }));
test('empty performance excludes examples and has no fabricated history', () => {
  const stats = performanceStatistics(initialDemo());
  assert.equal(stats.completed, 0); assert.equal(stats.winRate, null); assert.equal(stats.average, null); assert.equal(stats.fees, 0);
  assert.deepEqual(realizedHistory(initialDemo()), []);
});
test('fees and realized statistics reuse immutable settlement and preserve accounting through transfer', () => {
  let state = demoReducer(initialDemo(), buy);
  assert.equal(performanceStatistics(state).fees, state.active.execution.entry.fee);
  assert.equal(performanceStatistics(state).completed, 0);
  state = demoReducer(state, { type: 'SELL' });
  const trade = state.completed[0];
  const stats = performanceStatistics(state);
  assert.equal(stats.completed, 1); assert.equal(stats.losses, 1); assert.equal(stats.wins, 0); assert.equal(stats.winRate, 0);
  assert.equal(stats.average, trade.profit); assert.equal(stats.fees, trade.execution.entry.fee + trade.execution.exit.exitFee);
  const transferred = demoReducer(state, { type: 'TRANSFER' });
  assert.deepEqual(performanceStatistics(transferred), stats);
  assert.equal(portfolioSummary(transferred).value, 0);
  assert.equal(realizedHistory(state)[0].time, trade.execution.exit.closedAt);
  assert.equal(realizedHistory(state)[0].realized, stats.realized);
});
test('winning and breakeven legacy records contribute to totals without inventing dates or fees', () => {
  const state = initialDemo();
  state.completed = [10, -5, 0].map((profit, i) => ({ ...state.completed[0], id: i + 1, example: false, legacy: true, profit }));
  const stats = performanceStatistics(state);
  assert.equal(stats.wins, 1); assert.equal(stats.losses, 1); assert.equal(stats.breakeven, 1); assert.equal(stats.realized, 5); assert.equal(stats.fees, 0);
  assert.deepEqual(realizedHistory(state), []);
});
test('journal persists, deletes empty notes, and never modifies receipts or balances', () => {
  const closed = demoReducer(demoReducer(initialDemo(), buy), { type: 'SELL' });
  const receipt = JSON.stringify(closed.completed[0]);
  const id = closed.completed[0].id;
  const edited = demoReducer(closed, { type: 'JOURNAL', tradeId: id, note: 'Review entry timing.' });
  assert.equal(roundTrip(edited).asset, 'ETH');
  assert.equal(roundTrip(edited).state.journal[id], 'Review entry timing.');
  assert.equal(JSON.stringify(edited.completed[0]), receipt);
  assert.deepEqual(portfolioSummary(edited), portfolioSummary(closed));
  assert.equal(demoReducer(closed, { type: 'JOURNAL', tradeId: -1, note: 'example' }), closed);
  assert.equal(demoReducer(closed, { type: 'JOURNAL', tradeId: id, note: 'x'.repeat(2001) }), closed);
  assert.equal(roundTrip(demoReducer(edited, { type: 'JOURNAL', tradeId: id, note: '' })).state.journal, undefined);
  const invalid = JSON.parse(encodePaperTrading({ asset: 'ETH', state: edited }));
  invalid.state.journal['999'] = 'orphan'; assert.equal(decodePaperTrading(JSON.stringify(invalid)), null);
});
test('time ranges omit missing observations and future points', () => {
  const points = [{ time: 1, realized: 5 }, { time: 100000000, realized: 10 }, { time: 200000000, realized: 20 }];
  assert.deepEqual(filterHistory(points, '1D', 100000001), [points[1]]);
  assert.deepEqual(filterHistory(points, 'ALL', 100000001), points.slice(0, 2));
});
test('journal and asset survive store refresh and stale quotes block manual live exits', () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; }, removeItem: () => { raw = null; } };
  const store = createPaperTradingStore(() => storage); store.hydrate(); store.setAsset('SOL'); store.dispatch(buy); store.dispatch({ type: 'SELL' });
  const id = store.getSnapshot().state.completed[0].id;
  store.dispatch({ type: 'JOURNAL', tradeId: id, note: 'Persist me' });
  const restored = createPaperTradingStore(() => storage); restored.hydrate();
  assert.equal(restored.getSnapshot().asset, 'SOL'); assert.equal(restored.getSnapshot().state.journal[id], 'Persist me');
  restored.dispatch({ ...buy, requestId: 'second' }); restored.setMarketMode('live');
  const active = restored.getSnapshot().state.active;
  restored.dispatch({ type: 'SELL' }); assert.equal(restored.getSnapshot().state.active, active);
});
