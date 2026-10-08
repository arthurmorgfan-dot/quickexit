# €10,000 Demo Portfolio checkpoint

Implemented locally; not committed, pushed or deployed. Hosted accounts remain
behind the existing disabled gate. Coinbase quotes/charts and all execution,
confirmation, protection, immutable receipt and history behavior are retained.

New guest workspaces and confirmed Reset Demo start with 1,000,000 integer EUR
cents. BUY reserves the entire budget from available cash; the entry fee remains
inside that budget as before. Insufficient cash is rejected in both form and
reducer. Closing credits the engine's after-cost proceeds once. Net portfolio
value is cash plus estimated after-cost liquidation proceeds. Invested means
original capital committed; realized P&L excludes seed examples. Sent-home cash
is no longer included in portfolio value; simulated send-home still transfers all
available virtual cash. No external funds or execution are involved.

## Persistence compatibility

Version 3 and database objects are unchanged. An optional durable
`state.portfolioCapital` records the funding basis and validates:

`capital + realized net P&L = available cash + sent home + active investment`.

Older snapshots without that field continue using their original accounting
validation and retain cash, positions, receipts, history and preferences exactly.
On their next buy/close, a funding basis is inferred from existing records without
adding money or recalculating receipts. Older zero-cash demos must sell an existing
position or explicitly reset; they do not receive an automatic top-up. The UI
explains the preserved balance and reset option. Clients predating this optional
field do not understand portfolio accounting; do not test rollback clients against
new saved data without preserving a copy.

Invalid saved data is copied to a timestamped device recovery key before the
primary key is replaced. If backup fails, persistence is blocked to protect the
original, and the UI reports it is not saved. Reset is explicit and confirmed;
it clears owned current state, leaving recovery copies and unrelated keys alone.

## Manual acceptance

1. `npm run dev`, open `/`, choose **Try €10,000 Demo** in a fresh browser profile.
2. Open a €100 BTC trade with +€5 target and confirm the paper estimate.
3. Cash becomes €9,900; initial net portfolio value includes estimated costs.
4. Refresh; position and cash remain. Expand **Try a demo outcome** on mobile.
5. **Reach target**: one receipt, +€5 realized net profit, €10,005 available.
6. Refresh, inspect Positions and receipt; values remain fixed.
7. Settings → Reset Demo → **Keep this demo** preserves it. Confirming Reset
   Demo restores €10,000 with no user trades; refresh retains that starting state.
8. Settings → Market data → Live preserves read-only Coinbase prices and charts.
   Demo outcome controls disappear; no Live price manipulation is possible.

Automated coverage includes original regression tests with funded-balance
expectations, plus portfolio funding, affordability, net valuation, repeated
closes, old snapshots, persistence, reset and failed recovery backup. Optional
`tests/demo-portfolio-browser.mjs` uses the same externally provided Playwright
module/Chromium environment variables as `tests/market-browser.mjs`; no new
browser dependency is installed in the project.

## Local validation results

TypeScript, ESLint, production build and all 124 automated tests passed.
Both optional browser suites passed at 320, 390, 768 and 1440px with no overflow
or uncaught runtime errors: Demo purchase/refresh/target/reset, plus all six Live
chart ranges, candlestick/line switching, mock provider outage and immutable
receipts. Browser Live checks used intercepted fixture responses, not a new
verification of hosted Coinbase availability or hosted Supabase behavior.
