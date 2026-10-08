import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScript } from "./load-typescript.mjs";
const {
  normalizeTicker,
  normalizeStats,
  normalizeCandles,
  WINDOWS,
  TIMEFRAMES,
  dataStatus,
  chartPoints,
} = loadTypeScript("src/lib/market/models.ts");
const { createExchangeProvider, createMarketService, MarketFailure } =
  loadTypeScript("src/lib/market/service.ts");
const { createServerQuoteProvider } = loadTypeScript(
  "src/lib/market/client.ts",
);
const now = 1800000000000;
const ticker = { price: "100", time: new Date(now).toISOString() };
const statistics = {
  open: "100",
  last: "110",
  high: "120",
  low: "90",
  volume: "200",
};
const candle = [1800000000, 90, 120, 100, 110, 2];
const reply = (v) =>
  new Response(JSON.stringify(v), {
    headers: { "Content-Type": "application/json" },
  });
test("ticker and 24h statistics normalization preserve EUR prices and base-asset volume", () => {
  assert.deepEqual(normalizeTicker(ticker, now), {
    price: 100,
    updatedAt: now,
  });
  const stats = normalizeStats(statistics);
  assert.equal(stats.volume, 200);
  assert.ok(Math.abs(stats.change - 10) < 1e-10);
  for (const bad of [
    { ...ticker, price: "NaN" },
    { ...ticker, time: new Date(now + 20000).toISOString() },
    { price: 0, time: ticker.time },
  ])
    assert.throws(() => normalizeTicker(bad, now));
  for (const bad of [
    { ...statistics, volume: "-1" },
    { ...statistics, low: "130" },
    { ...statistics, last: "Infinity" },
  ])
    assert.throws(() => normalizeStats(bad));
});
test("OHLCV sorting, duplicate removal and gaps never generate invented prices", () => {
  const next = [candle[0] + 120, ...candle.slice(1)];
  const candles = normalizeCandles(
    [next, candle, candle],
    candle[0],
    next[0],
    60,
  );
  assert.equal(candles.length, 2);
  assert.equal(candles[0].time, candle[0]);
  assert.deepEqual(normalizeCandles([], 0, now, 60), []);
  assert.throws(() =>
    normalizeCandles([[candle[0], 110, 120, 100, 110, 2]], 0, now, 60),
  );
  assert.throws(() =>
    normalizeCandles([candle, [candle[0], 90, 120, 100, 111, 2]], 0, now, 60),
  );
  assert.throws(() =>
    normalizeCandles([[candle[0] + 1, ...candle.slice(1)]], 0, now, 60),
  );
});
test("all requested timeframes are bounded and candle/line projections retain the same observations", () => {
  assert.deepEqual(TIMEFRAMES, ["1H", "4H", "1D", "1W", "1M", "1Y"]);
  for (const t of TIMEFRAMES)
    assert.ok(WINDOWS[t].seconds / WINDOWS[t].granularity <= 365);
  const c = normalizeCandles([candle], candle[0], candle[0], 60);
  assert.deepEqual(chartPoints(c, "line"), [{ time: candle[0], value: 110 }]);
  assert.deepEqual(chartPoints(c, "candles"), [
    { time: candle[0], open: 100, high: 120, low: 90, close: 110 },
  ]);
  assert.equal(c[0].volume, 2);
});
test("live, delayed, stale and unavailable status uses observation age rather than cache fetch time", () => {
  assert.equal(dataStatus(undefined, false, now), "Unavailable");
  assert.equal(dataStatus({ price: 100, updatedAt: now }, false, now), "Live");
  assert.equal(
    dataStatus({ price: 100, updatedAt: now - 60000 }, false, now),
    "Delayed",
  );
  assert.equal(
    dataStatus({ price: 100, updatedAt: now - 130000 }, false, now),
    "Stale",
  );
  assert.equal(dataStatus({ price: 100, updatedAt: now }, true, now), "Stale");
});
test("public provider retries transient failures and sends no credentials or execution requests", async () => {
  let calls = 0;
  const pauses = [];
  const provider = createExchangeProvider(
    async (url, options) => {
      assert.match(url, /\/products\/BTC-EUR\/ticker$/);
      assert.equal(options.method, "GET");
      assert.equal(options.credentials, "omit");
      return ++calls === 1 ? new Response("", { status: 503 }) : reply(ticker);
    },
    () => now,
    async (ms) => pauses.push(ms),
  );
  assert.equal((await provider.quote("BTC")).price, 100);
  assert.equal(calls, 2);
  assert.ok(pauses.includes(500));
});
test("429 honors Retry-After, stops retry storms and recovers after cooldown", async () => {
  let clock = now,
    calls = 0;
  const provider = createExchangeProvider(
    async () =>
      ++calls === 1
        ? new Response("", { status: 429, headers: { "Retry-After": "60" } })
        : reply(ticker),
    () => clock,
    async () => {},
  );
  await assert.rejects(
    provider.quote("BTC"),
    (e) => e instanceof MarketFailure && e.retryAfter === 60,
  );
  await assert.rejects(provider.quote("ETH"));
  assert.equal(calls, 1);
  clock += 61000;
  assert.equal((await provider.quote("BTC")).price, 100);
  assert.equal(calls, 2);
});
test("nonretryable provider errors and malformed data never become quotes", async () => {
  let calls = 0;
  const denied = createExchangeProvider(
    async () => {
      calls++;
      return new Response("", { status: 404 });
    },
    () => now,
    async () => {},
  );
  await assert.rejects(denied.quote("BTC"));
  assert.equal(calls, 1);
  const malformed = createExchangeProvider(
    async () => reply({ price: "100", time: "bad" }),
    () => now,
    async () => {},
  );
  await assert.rejects(malformed.quote("BTC"));
});
test("year history pages stay within Coinbase 300-candle limits and deduplicate boundaries", async () => {
  const paths = [];
  const provider = createExchangeProvider(
    async (url) => {
      const u = new URL(url);
      paths.push(u);
      const start = Date.parse(u.searchParams.get("start")) / 1000,
        end = Date.parse(u.searchParams.get("end")) / 1000;
      assert.ok((end - start) / 86400 <= 299);
      return reply([
        [start, 90, 120, 100, 110, 2],
        [end, 90, 120, 100, 110, 2],
      ]);
    },
    () => now,
    async () => {},
  );
  const h = await provider.history("BTC", "1Y");
  assert.equal(paths.length, 2);
  assert.equal(h.candles.length, 3);
  assert.ok(h.gaps > 0);
  assert.equal(h.timeframe, "1Y");
});
test("service coalesces concurrent requests, caches and retains stale data without changing observation timestamps", async () => {
  let calls = 0,
    clock = now,
    fail = false;
  const service = createMarketService(
    {
      quote: async () => {
        calls++;
        if (fail) throw Error("offline");
        return { price: 100, updatedAt: now };
      },
    },
    () => clock,
  );
  const [a, b] = await Promise.all([
    service.quote("BTC"),
    service.quote("BTC"),
  ]);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
  await service.quote("BTC");
  assert.equal(calls, 1);
  fail = true;
  clock += 16000;
  const stale = await service.quote("BTC");
  assert.equal(stale.stale, true);
  assert.equal(stale.data.updatedAt, now);
  assert.equal(stale.fetchedAt, now);
  await service.quote("BTC");
  assert.equal(calls, 2);
  clock += 3600001;
  await assert.rejects(service.quote("BTC"));
});
test("empty provider failures are cooled down and cannot corrupt another asset cache", async () => {
  let calls = 0;
  const service = createMarketService(
    {
      quote: async (asset) => {
        calls++;
        if (asset === "BTC") throw Error("outage");
        return { price: 110, updatedAt: now };
      },
    },
    () => now,
  );
  await assert.rejects(service.quote("BTC"));
  await assert.rejects(service.quote("BTC"));
  assert.equal(calls, 1);
  assert.equal((await service.quote("ETH")).data.price, 110);
  assert.equal(calls, 2);
});
test("client quote adapter rejects stale envelopes, old observations and missing asset quotes", async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      reply({
        source: "Coinbase Exchange",
        stale: false,
        fetchedAt: Date.now(),
        data: { price: 100, updatedAt: Date.now() },
      });
    assert.equal(
      (
        await createServerQuoteProvider().fetchQuotes(
          new AbortController().signal,
        )
      ).BTC.price,
      100,
    );
    for (const data of [
      {
        source: "Coinbase Exchange",
        stale: true,
        fetchedAt: Date.now(),
        data: { price: 100, updatedAt: Date.now() },
      },
      {
        source: "Coinbase Exchange",
        stale: false,
        fetchedAt: Date.now(),
        data: { price: 100, updatedAt: Date.now() - 180000 },
      },
      {
        source: "Coinbase Exchange",
        stale: false,
        fetchedAt: Date.now(),
        data: {},
      },
    ]) {
      globalThis.fetch = async () => reply(data);
      await assert.rejects(
        createServerQuoteProvider().fetchQuotes(new AbortController().signal),
      );
    }
  } finally {
    globalThis.fetch = saved;
  }
});

test("market API allowlists assets, resource types and timeframes before provider access", async () => {
  const { createMarketApi } = loadTypeScript("src/lib/market/api.ts");
  let calls = 0;
  const api = createMarketApi({
    quote: async () => {
      calls++;
      return {
        data: { price: 100, updatedAt: now },
        stale: false,
        fetchedAt: now,
        source: "Coinbase Exchange",
      };
    },
  });
  for (const query of [
    "asset=DOGE&kind=quote",
    "asset=BTC&kind=orders",
    "asset=BTC&kind=history&timeframe=ALL",
    "kind=quote",
  ])
    assert.equal(
      (await api(new Request("http://localhost/api/market?" + query))).status,
      400,
    );
  assert.equal(calls, 0);
  const r = await api(
    new Request("http://localhost/api/market?asset=BTC&kind=quote"),
  );
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(calls, 1);
});
test("market API reports safe unavailability and cooldown without provider details", async () => {
  const { createMarketApi } = loadTypeScript("src/lib/market/api.ts");
  const api = createMarketApi({
    quote: async () => {
      throw new MarketFailure(45);
    },
  });
  const r = await api(
    new Request("http://localhost/api/market?asset=BTC&kind=quote"),
  );
  assert.equal(r.status, 503);
  assert.equal(r.headers.get("retry-after"), "45");
  assert.deepEqual(await r.json(), { error: "Market data unavailable" });
});

test("rate limit Retry-After HTTP dates are respected without leaking provider responses", async () => {
  const provider = createExchangeProvider(
    async () =>
      new Response("internal-provider-details", {
        status: 429,
        headers: { "Retry-After": new Date(now + 45000).toUTCString() },
      }),
    () => now,
    async () => {},
  );
  await assert.rejects(
    provider.quote("BTC"),
    (e) => e.retryAfter === 45 && !e.message.includes("internal-provider"),
  );
});
