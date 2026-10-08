/** Optional isolated browser QA; use the same browser env vars as market-browser.mjs. */
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.QUICKEXIT_BROWSER_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.QUICKEXIT_BROWSER_EXECUTABLE || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const base = process.env.QUICKEXIT_TEST_URL || "http://127.0.0.1:3001";
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    const demo = page.getByRole("link", {
      name: "Try €10,000 Demo",
      exact: true,
    });
    assert.equal(await demo.getAttribute("href"), "/app");
    await demo.click();
    const portfolio = page.getByRole("region", { name: "Simulated portfolio" });
    await portfolio.getByText("€10,000.00", { exact: true }).first().waitFor();
    await page
      .getByRole("button", { name: "Buy & Auto-Exit", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm Paper Trade", exact: true })
      .click();
    await portfolio.getByText("€9,900.00", { exact: true }).waitFor();
    await page.reload();
    await portfolio.getByText("€9,900.00", { exact: true }).waitFor();
    const outcome = page.getByRole("button", {
      name: "Try a demo outcome",
      exact: false,
    });
    if (await outcome.isVisible()) await outcome.click();
    await page
      .getByRole("button", { name: "Reach target", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Target reached", exact: true })
      .waitFor();
    await portfolio.getByText("€10,005.00", { exact: true }).first().waitFor();
    await page.reload();
    await portfolio.getByText("€10,005.00", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
    await page
      .getByRole("button", { name: "Keep this demo", exact: true })
      .click();
    await page.getByRole("button", { name: "Trade", exact: true }).click();
    await portfolio.getByText("€10,005.00", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
    await page.getByRole("button", { name: "Reset Demo", exact: true }).click();
    await page.getByRole("button", { name: "Trade", exact: true }).click();
    await portfolio.getByText("€10,000.00", { exact: true }).first().waitFor();
    await page.reload();
    await portfolio.getByText("€10,000.00", { exact: true }).first().waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        width,
        demoBalance: true,
        purchase: true,
        refresh: true,
        target: true,
        resetConfirmation: true,
        overflow: false,
        errors: 0,
      }),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
