/** Optional browser QA: provide an installed Playwright module and Chromium executable.
 * No project browser dependency, provider access or production data is required. */
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.QUICKEXIT_BROWSER_MODULE || "playwright"
);
const base = process.env.QUICKEXIT_TEST_URL || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  executablePath: process.env.QUICKEXIT_BROWSER_EXECUTABLE || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const windows = {
  "1H": [3600, 60],
  "4H": [14400, 300],
  "1D": [86400, 900],
  "1W": [604800, 3600],
  "1M": [2592000, 21600],
  "1Y": [31536000, 86400],
};
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [];
    let price = 63421.2,
      outage = false,
      missing = false,
      requests = 0;
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/market?*", async (route) => {
      requests++;
      const q = new URL(route.request().url()).searchParams,
        kind = q.get("kind"),
        asset = q.get("asset"),
        timeframe = q.get("timeframe");
      if (outage)
        return route.fulfill({
          status: 503,
          json: { error: "Market data unavailable" },
        });
      const updatedAt = Date.now();
      let data;
      if (kind === "quote")
        data = {
          price: asset === "BTC" ? price : asset === "ETH" ? 3200 : 150,
          updatedAt,
        };
      else if (kind === "stats")
        data = {
          open: price * 0.98,
          last: price,
          high: price * 1.02,
          low: price * 0.96,
          volume: 2000,
        };
      else {
        const [seconds, granularity] = windows[timeframe];
        const end = Math.floor(updatedAt / 1000 / granularity) * granularity;
        const candles = missing
          ? []
          : Array.from({ length: 20 }, (_, i) => ({
              time: end - (19 - i) * granularity,
              open: price * (0.99 + i * 0.0002),
              high: price * (1.005 + i * 0.0002),
              low: price * (0.98 + i * 0.0002),
              close: price * (0.995 + i * 0.0002),
              volume: 2,
            }));
        data = { asset, timeframe, granularity, gaps: 0, candles };
        assert.ok(seconds > 0);
      }
      return route.fulfill({
        json: {
          data,
          fetchedAt: updatedAt,
          stale: false,
          source: "Coinbase Exchange",
        },
      });
    });
    await page.goto(base + "/app?demo=1");
    await page
      .getByRole("button", { name: "Buy & Auto-Exit", exact: true })
      .waitFor();
    assert.equal(requests, 0, "Demo must not fetch market history/quotes");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Live", exact: true }).click();
    await page.getByRole("button", { name: "Trade", exact: true }).click();
    const reveal = page.getByRole("button", {
      name: "Price chart",
      exact: false,
    });
    if (await reveal.isVisible()) await reveal.click();
    await page.locator(".qw-interactive-chart canvas").first().waitFor();
    await page.getByRole("button", { name: "1W", exact: true }).click();
    await page.getByRole("button", { name: "Candles", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "1W", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.locator('[role="img"][aria-label^="Candlestick"]').waitFor();
    await page.getByRole("button", { name: "Line", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "1W", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    for (const timeframe of Object.keys(windows)) {
      await page.getByRole("button", { name: timeframe, exact: true }).click();
      await page.locator(".qw-interactive-chart canvas").first().waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
    }
    await page.locator(".qw-chart-data summary").click();
    await page.locator(".qw-chart-data tbody tr").first().waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    if (width >= 768) {
      const rect = await page
        .locator(".qw-interactive-chart canvas")
        .first()
        .boundingBox();
      await page.mouse.move(rect.x + rect.width / 2, rect.y + 70);
      await page.waitForTimeout(150);
      assert.match(
        await page.locator(".qw-interactive-chart > p").first().textContent(),
        /€/,
      );
    }
    missing = true;
    await page.locator("#asset-choice").selectOption("ETH");
    await page.getByText(/^History unavailable for this range\./).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "1Y", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    missing = false;
    await page.locator("#asset-choice").selectOption("BTC");
    await page.locator(".qw-interactive-chart canvas").first().waitFor();
    await page
      .getByRole("button", { name: "Buy & Auto-Exit", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Paper Trade", exact: true })
      .click();
    await page.getByText("Current net profit", { exact: true }).waitFor();
    const initial = await page.locator(".qw-active .qw-profit").textContent();
    price *= 1.01;
    await page.reload();
    await page.getByText("Current net profit", { exact: true }).waitFor();
    await page.waitForFunction(
      (value) =>
        document.querySelector(".qw-active .qw-profit")?.textContent !== value,
      initial,
    );
    const last = await page.locator(".qw-active .qw-profit").textContent();
    outage = true;
    await page.reload();
    await page.getByText("Current net profit", { exact: true }).waitFor();
    assert.equal(
      await page.locator(".qw-active .qw-profit").textContent(),
      last,
      "Outage holds paper valuation",
    );
    outage = false;
    price *= 1.1;
    await page.reload();
    await page
      .getByRole("heading", { name: "Target reached", exact: true })
      .waitFor();
    await page.getByText("View paper trade receipt", { exact: true }).click();
    const receipt = await page.locator(".qw-trade-receipt").textContent();
    price *= 1.1;
    await page.reload();
    await page
      .getByRole("heading", { name: "Target reached", exact: true })
      .waitFor();
    await page.getByText("View paper trade receipt", { exact: true }).click();
    assert.equal(
      await page.locator(".qw-trade-receipt").textContent(),
      receipt,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        line: true,
        candles: true,
        timeframes: 6,
        keyboardData: true,
        livePaperValuation: true,
        outage: true,
        receiptImmutable: true,
        overflow: false,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
