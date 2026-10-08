# QuickExit

A responsive public landing page for the QuickExit crypto trading concept: **Trade it. Profit. Send it home.**

## Run locally

Use Node.js 22 or newer (required by the Supabase SDK); this checkpoint was verified with Node.js 24.20.0.

```bash
npm install
npm run dev
```

Open http://localhost:3000. For a production preview, run `npm run build` followed by `npm start`.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Structure

- `src/app/page.tsx` assembles the landing page.
- `src/app/globals.css` contains the design tokens, styles, responsive layouts, and reduced-motion rules.
- `src/app/layout.tsx` sets metadata and loads locally hosted Geist fonts.
- `src/components/landing/` contains individual page sections.
- `src/components/ui/` contains the reusable brand and CTA components.

Next.js App Router, React, TypeScript, and Lucide icons. Styling uses plain CSS, with no runtime styling dependency or external font request. The local Geist font files come from the installed Next.js distribution.

The interactive preview supports investment amounts, euro or percentage profit targets, optional protection, and an auto-exit switch. Its progress and euro amounts update locally. The action button explains the selected mock trade without submitting data. Mobile navigation, FAQ disclosures, and linked prototype notices are functional.

This is a product concept only. Landing-page market figures are mock data; the paper workspace optionally reads public market quotes. Optional Supabase accounts save paper state across devices. There is no real trading backend, payment processing, or financial partner integration. Header Get Started leads to `/signup`; Start Trading opens `/app`, and Sign in leads to `/signin`. Privacy and Terms describe this prototype rather than a future live service.

## Production identity

The canonical landing URL is `https://quickexit.net/`. Homepage metadata includes Open Graph and X/Twitter cards. `/opengraph-image` generates a static 1200×630 PNG during the build. `/robots.txt` permits public crawling and points to `/sitemap.xml`, which lists only the landing URL.

QuickExit provides an SVG browser icon, a multi-resolution ICO favicon, and a 180×180 Apple touch icon. Unmatched routes use the branded `not-found.tsx` page with a home link and the prototype/risk notice; Next.js adds `noindex` to the 404.

Landing anchor navigation opens linked prototype disclosures, moves keyboard focus to the destination, and handles repeated clicks and direct hash URLs. The mobile menu supports Escape and closes on desktop resize. Animations and smooth scrolling respect reduced-motion preferences.

## Phase two: desktop workspace

`/app` is a responsive client-side trading prototype. Its sidebar contains Home, Trade, Positions, Activity, Cash Out, and Settings views, all within the same route and shared local paper-trading state. BTC is selected by default; ETH and SOL are also supported with Demo or Live EUR prices. The existing landing page keeps its visual design and links its primary CTAs to `/app`.

To test the full flow:

1. Open `/app`. Leave the default €100 amount, +€5 target, and enabled auto-exit. Click **Buy & Auto-Exit**, review the estimates, then **Confirm Paper Trade**.
2. Pause **Subtle price movement** for exact, repeatable values. Click **Profit rises**: the position shows +€3.82 / 76% (if no tick occurred before pausing).
3. Click **Reach target**: the position closes automatically at +€5 and makes €105 available.
4. Click **Send to Bank**, then **Send €105.00 to Bank**. The placeholder account is •••• 4821. The screen confirms €105 sent home, and available cash returns to zero.
5. Explore Positions and Activity to see the completed trade and readable event history.

For other scenarios, choose protection before opening a trade and use **Profit falls**. **Sell Now** closes at the current simulated profit/loss. **Edit Target** updates an active target; lowering it to or below current profit closes immediately when auto-exit is enabled. Disable auto-exit before buying to monitor and sell manually. Amount, target, and protection support validated custom values. Percentage targets show their euro equivalent.

Mock prices move deterministically every four seconds while a position is active. Reduced-motion preferences pause movement by default; it can be enabled deliberately. Settings includes a session reset. Paper-trading state is saved locally on this device and survives refresh. Historical BTC/ETH/SOL examples are labeled and excluded from the session’s balances. Live mode makes read-only public market-data requests. There are no real transactions or banking forms. `/app` is marked `noindex` and excluded from the sitemap.

Workspace components are in `src/components/workspace/`, scoped styles in `src/app/app/workspace.css`, and the simulation reducer in `src/lib/demo-trading.ts`. Financial amounts use integer cents. Run `npm test` for the simulation’s accounting and lifecycle checks, alongside the lint, TypeScript, and production build checks.

## Mobile workspace

At viewport widths of 700px and below, `/app` uses a dedicated mobile layout. Five safe-area-aware bottom-navigation buttons open Trade, Positions, Activity, Cash Out, and Settings; the header Home button opens the overview. The desktop layout and simulation reducer are unchanged.

The active trade and completed-trade result appear before market information. Current profit, euro target, progress, invested value, auto-exit status, Sell Now, and Edit Target remain prominent. Price charts, market information after buying, optional protection, position details, and demo controls use accessible expandable sections. Positions use stacked cards instead of a scrolling table. Numeric inputs use 16px text and decimal keyboards, and the bottom navigation hides while an input has focus.

To test on a phone or a narrow responsive viewport (try 320, 390, 430, and 700px):

1. Open `/app`, use bottom-nav Settings to pause subtle price movement, and return to Trade.
2. Keep €100 / +€5 / auto-exit on and tap **Buy & Auto-Exit**, review the estimates, then **Confirm Paper Trade**. The profit card replaces the form and is brought into view.
3. Expand **Try a demo outcome**, tap **Profit rises**, then **Reach target**. Check +€3.82 / 76%, followed by the target-reached result.
4. Tap **Send to Bank** and the simulated transfer action. Verify €105 sent home and €0 available.
5. Inspect Positions, Activity, and Settings through bottom navigation. Test Edit Target, custom numeric fields, protection, and disclosures. Resize above 700px to verify the original desktop layout remains available.

All transactions are simulated. No exchange accounts, banking data, payments, or real trading execution are used.

## Persistent local paper trading

`src/lib/paper-trading-storage.ts` owns the `quickexit.paper-trading` localStorage key and version 3 schema (v1/v2 positions migrate without retroactive fees). It serializes an explicit durable snapshot: selected asset, active/completed positions, last result/transfer, cash, sent-home total, activity, sequence/tick counters, and price-movement preference. Current paper price, the fixed acquisition fill and cost assumptions are recorded; last-known live quotes and the Market data preference are saved separately. Editor drafts, current view, confirmations, disclosures, and live-region announcements are not saved.

Restoration validates types, assets, cents, price bounds, position/exit consistency, unique IDs, and the cash-plus-sent ledger against real demo trade proceeds. Unknown properties are discarded; sample history is canonical and excluded from balances. Malformed data or unsupported versions start a clean demo with a recovery notice. Browser storage errors leave a usable temporary demo and a truthful “Not saved on this device” status.

`src/lib/paper-trading-store.ts` manages hydration, immediate saves after domain actions, and reset. `usePersistentDemo.ts` connects it to React with `useSyncExternalStore`: SSR and initial client hydration share the same stable initial snapshot, storage is read only after mount, controls stay inert until restoration, and price movement starts only afterward. No offline demo price catch-up occurs. Live mode evaluates the next fresh market quote after refresh. Explicit saved movement preferences survive refresh; fresh/reset demos respect reduced-motion defaults. Other tabs on the same origin synchronize through storage events. This section describes the guest demo: device-local edits use the last saved snapshot. Signed-in accounts use the revision-checked cloud layer described below.

Settings → **Reset demo** opens an explicit confirmation before removing the owned key and restoring BTC, zero cash/sent totals, welcome activity, default settings, and the initial illustrative history. Cancellation does not modify storage. The next reload restores the clean initial demo. Unrelated localStorage keys are never cleared.

Refresh test: reset the demo, pause price movement in Settings, buy €100 BTC with a +€5 target, and refresh. Reach the target and refresh again: the closed position and €105 remain. Send €105 to the demo bank and refresh: cash stays €0, sent-home total is €105, and the activity record remains. Confirm Reset demo and refresh to verify a clean initial state. Run `npm test` for both simulation and persistence tests.

### Read-only market prices

Settings → **Market data → Live** reads BTC-EUR, ETH-EUR and SOL-EUR ticker prices from Coinbase’s public endpoint, without credentials, cookies or execution calls. `src/lib/market-data.ts` contains the replaceable `MarketDataProvider` interface, Coinbase adapter, quote validation and serial 30-second polling. Requests time out after 10 seconds; polling stops on unmount or switching to Demo, and late responses are ignored. No additional dependency, server route, account or backend is introduced. Provider documentation: https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-ticker

The store accepts only complete, positive, finite EUR quotes with timestamps at most two minutes old (10-second future clock tolerance); older-than-cached responses are rejected. Invalid or failed requests change connection status only, never financial state. Last-known quotes are retained and labelled as unavailable/stale. Without any cached quote, the existing Demo reference price is displayed explicitly and new Live paper trades wait for a valid quote. Existing positions hold their last P&L until fresh quotes return. Switch to Demo for deterministic outcomes; Live never runs demo ticks or outcome controls. Demo remains the default to preserve existing paper-trading behavior.

A Live paper trade fixes its entry price to the latest valid quote. Net profit is simulated sell proceeds after exit costs minus the full investment, including its entry fee. Auto-exit and protection close locally at the observed quote, including any overshoot; target prices are never fabricated. Prices are market observations, not executable quotes; fees, spread and slippage are conservative simulated estimates. Returning to Live may immediately close a paper position on its next fresh quote. Switching to Demo retains the entry price and starts deterministic movement from the current profit. Charts and Demo percentage changes remain explicitly illustrative.

Version 3 stores fixed paper fills, quantities, cost snapshots and closed receipts alongside Market data mode, last-known prices/timestamps, fixed entries, P&L and observed automatic exit prices. Transient connection/loading/error status is not saved. Reset demo clears quotes and returns to Demo prices. Test with Settings → Live, open a paper trade, refresh and verify its fixed entry; disconnect networking and confirm last values remain with an error message. Switch to Demo and try Profit rises / Profit falls / Reach target for repeatable exits. `npm test` covers the adapter, unavailable/stale/invalid data, mode switching, P&L, exits, cancellation, v1 migration and refresh persistence, plus the full original simulation suite.

### Net paper execution

`src/lib/paper-execution.ts` owns the replaceable `ExecutionCosts` model and all acquisition, valuation and target-price arithmetic. Defaults are 0.60% entry fee, 0.60% exit fee, 0.10% total spread (half per side), and 0.05% slippage per side. These are illustrative conservative assumptions, not Coinbase fee quotes. Settings displays them, and active/completed trades expose a compact expandable cost receipt. Neither the landing page nor approved workspace layout is redesigned.

Investment is the entire funded budget in cents. Entry fee is rounded up against that budget and deducted once; the remainder acquires crypto at `quoted price × (1 + half spread + slippage)`. Quantity, quoted/execution entry prices, fee, timestamp, request ID and assumptions are fixed on opening. Exit value uses `market price × (1 − half spread − slippage)`; sale notional is rounded down and exit fee rounded up. Net P&L is the resulting proceeds minus the original investment. Gross P&L is the acquired quantity’s change in quoted value; net P&L reconciles gross P&L less entry cost (fee/entry impact) and exit cost (fee/exit impact). Active exit fees are estimates, not repeated balance debits. Closed trades store one immutable receipt and credit proceeds once.

Euro targets and percentage targets both represent **net return on all invested capital**. The inverse target calculation includes rounded costs and produces the market price necessary for those net proceeds. Demo Reach target generates that price and passes through the same valuation/close path as Live; Profit rises/falls remain predictable net outcomes. Live quotes are never adjusted. Live target/protection gaps settle at the observed quote, so outcomes can exceed targets or losses can exceed protection. Editing a target closes at the current quote, preserving profit above the lowered threshold. Immediate opening costs may already meet a tight protection setting; the form warns and the engine closes accordingly.

Schema v3 validates fills, fixed quantities, fees, valuations, receipts, unique position/request IDs and aggregate cash/sent conservation. V1/v2 positions retain their original zero-cost behavior, carry an explicit legacy label and upgrade on restoration without replaying activity. New trades use the current cost model. Stable request IDs prevent duplicate opens; position IDs guard stale sell/price callbacks; inactive/completed positions cannot close again. Transfer buttons use sequence guards, and refresh restores finalized records without running a sale or fee operation. The guest demo retains its last-writer local policy; account sync uses atomic revision checks and operation receipts as described below. This is not a real-money ledger.

Run `npm test` for original zero-cost regressions plus default-cost tests covering fees, rounding, configurable impact, euro/percentage targets, deterministic prices, live overshoots, protection, manual sale, duplicate operations, tampered records, migration and refresh/transfer persistence. Manual check: open €100 BTC with a +€5 target and no protection, inspect estimated costs, use Reach target, confirm €105 proceeds and refresh. The receipt retains the entry/exit fee and acquired quantity; Send to Bank still credits only simulated history.

## Accounts and cloud-synced paper beta

Try Demo remains at `/app?demo=1`, requires no registration and uses the existing `quickexit.paper-trading` storage key. `/app` restores an authenticated account when available; `/signin` and `/signup` provide minimal email/password forms. No exchange account, wallet, real payment, banking detail or exchange key is collected. All investment amounts, balances, sales and bank transfers remain simulated.

### Supabase setup (v0.4.1)

Accounts are currently unconfigured. `.env.local` contains empty values and is ignored by Git. Demo remains available. Do not paste credentials into source code or release notes.

The only application configuration required is:

- `NEXT_PUBLIC_SUPABASE_URL`: the isolated local or authorized non-production project API origin.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: that project's public publishable key (legacy `anon` accepted).

No service-role key, secret key, database password, exchange key or banking credential is required by this application. `npm run check:config` validates the same centralized configuration used by the clients without contacting a provider or printing values. Dev/build run this automatically. Missing values disable accounts; partial, privileged-key or malformed configuration stops dev/build with safe instructions. Runtime clients fail closed and preserve Try Demo.

For isolated local development, install the Supabase CLI and Docker, then run `supabase start` from this repository. **These tools are not available in the inspected environment; this local stack has not been started.** `supabase/config.toml` prepares localhost-only API/DB/Studio/mail testing, email confirmation, 12-character passwords and refresh-token rotation. It contains no secrets. Use the public URL/key reported by the local stack in `.env.local`, then restart Next.js. Local confirmation/recovery messages should be inspected through the stack's mail UI (configured on port 54324), not a real inbox. Do not link this workspace to production, run remote migrations, or reset an existing database. Preserve existing local data before any infrastructure changes. [Supabase local development](https://supabase.com/docs/guides/local-development), [configuration reference](https://supabase.com/docs/guides/local-development/cli/config).

For an authorized non-production hosted project, the owner must configure Email/password authentication, email confirmation, a password minimum of 12, rate limits and email delivery. Allow the exact requesting origin's `/auth/callback`: `http://localhost:3000/auth/callback` and/or `http://127.0.0.1:3000/auth/callback` locally. Set Site URL to the test application's origin. Keep confirmation/recovery templates compatible with Supabase's PKCE confirmation URL flow; open the email in the browser that initiated the request. The callback preserves the SDK's `sb_flow_id` and uses the provider-verified recovery result to select `/reset-password`, never a caller's redirect query. Provider secure-password-change settings may require a fresh authenticated session. [Password authentication/recovery](https://supabase.com/docs/guides/auth/passwords), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

The existing migration `supabase/migrations/202610080001_paper_accounts.sql` creates the account aggregate, operation receipts, grants/RLS and atomic revision-checked RPC. It is tested locally but **has not been applied to any hosted project in this pass**. Applying it remotely requires explicit approval and a non-production verification plan. Production URLs/redirects (`https://quickexit.net/auth/callback`) and hosting environment values are future deployment configuration, not instructions to change production now. Public Next.js values require a rebuild when changed.

### Boundaries and storage

`src/lib/supabase/browser.ts` owns the browser client. `server.ts` is server-only and owns request-cookie clients. `src/proxy.ts` refreshes sessions on auth/workspace routes; it does not protect the public demo. `/api/paper` independently calls server-side `auth.getUser()` on every request, does not trust a browser user ID, checks write Origin, bounds request bodies and validates the full existing paper schema/ledger before RPC writes. Account responses are private/no-store. `/auth/callback` has a fixed internal destination, never accepts a caller-controlled redirect, and does not log tokens. Only the public Supabase key is used.

One account-scoped JSON aggregate includes active/completed positions, fixed execution receipts, activity, cash, sent-home total, selected asset and demo preferences. Atomic snapshot commits prevent partial sale/fee/activity/balance saves. RLS limits authenticated reads to `auth.uid() = user_id`; anonymous reads are denied. Direct table writes are revoked. The SQL function derives its owner from `auth.uid()`, requires authentication, uses an empty search path, locks the row, compares the expected revision and writes a unique operation receipt in the same transaction. Its grants are limited to authenticated callers. Database-side ownership and CAS remain enforced even when callers bypass the Next.js API. This is simulated user-owned data, not a trusted real-money ledger.

`src/lib/account/workspace-store.ts` wraps the existing, unchanged execution store. Guests keep their original key. Account journals use `quickexit.account.<user-id>` and include the canonical device snapshot, confirmed cloud revision, queued changes and the exact in-flight operation ID/payload. The journal is written before sending; a lost response retries the same ID, so the database cannot add another revision/receipt or replay a sale. New changes queue behind the current operation. Authentication switches replace the active store synchronously; stale network responses cannot apply to a different account. Cross-device restoration never runs trade actions or fees. Price quotes are device caches (fresh live prices are fetched independently); active valuation and market mode are shared.

Temporary outages retain a usable, validated account cache and queued edits. Initial restoration without a known account copy blocks mutations, so an outage cannot overwrite unknown cloud data with a blank/demo state. Retry and online recovery resume saves. Every 15 seconds, quiet accounts check for another device's saved revision. Simultaneous edits are not silently merged: both copies are kept and an explicit **Use cloud copy / Use this device's copy** choice resolves the conflict using another revision check. Discarded device state is backed up at the account key plus `.recovery`. Signed-in Reset demo clears the account's simulated aggregate on the next successful sync; the one-time import decision remains committed.

Account caches remain in this browser after sign-out for offline recovery, isolated by user ID, and are not encrypted. Signing out restores the separate guest demo, not the account snapshot. Clearing browser storage removes these caches and any pending unsynced changes; it does not remove already-saved cloud data. Server-side RLS protects cloud records; local storage is not a security boundary against someone with access to the same browser profile. Supabase handles passwords/session credentials; QuickExit stores no banking details or exchange keys. Landing disclosures explain optional account storage.

### One-time local migration

An empty account with an existing meaningful local demo offers **Import this device's demo** or **Start fresh** before it can trade. Import copies the current validated state; it does not delete, merge or replay the guest demo. It is allowed once per account, atomically, only while the cloud aggregate is empty. Duplicate IDs retry safely, and distinct duplicate import requests are rejected once decided. A reset never re-enables import. New accounts with no meaningful demo start clean automatically. Existing account state always wins over an unsolicited local import.

### Beta verification

Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Tests cover account transitions, import/retry/reset, device separation, full net execution lifecycle across refresh, offline journals, lost responses, conflicts, corrupted data and late responses. PGlite is a test-only PostgreSQL runtime: the actual migration is exercised with separate authenticated/anonymous roles to verify RLS, direct-write denial, ownership, atomic revision checks and duplicate import/receipt prevention. Tests do not create real Supabase users or send confirmation emails.

With Supabase configured: make a €100/+€5 guest trade; create/confirm an account and import it. Refresh, sign out/in and sign in from a second browser: entry fill, active/completed positions, costs, history and cash must match. Reach target in Demo, send €105 to the simulated bank and verify the second device recovers €0 cash plus €105 sent home. Disconnect, make a paper change, reconnect and retry; then create conflicting edits on two devices to test explicit resolution. Sign into a second account to verify isolation. Confirm Reset demo and verify the guest demo is untouched and imports cannot be repeated.

## v0.4: review, trade and receipt

The existing Buy action now opens a review instead of an immediate paper fill. Confirm Paper Trade opens the simulated position; Go Back preserves the draft. Asset, account or Live/Demo changes discard the review. Live estimates follow the latest usable quote, and a quote/mode guard at the store boundary rejects stale confirmations rather than executing against the price the user did not review. No quote can be supplied by the review to override a Live provider price.

`estimatePaperTrade` in `paper-execution.ts` uses `openPaper`, `valuePaper` and `priceForNetProfit` for every financial estimate, including break-even (zero net profit), euro/percentage targets and estimated future exit costs at target. Percentage targets are net returns on the entire investment. Fees and rounding are unchanged. Displayed prices/quantity are rounded for readability; the engine retains full precision. Targets and protection remain estimates, not execution guarantees.

Completed history is newest closure first, with stacked mobile cards and a full receipt for each trade. `TradeReceipt.tsx` renders the `paperReceipt` projection from the saved entry and closing fill. Receipt IDs use the original unique request ID. Recorded entry, cost assumptions, closing valuation and completed position are frozen at closure and restoration. Receipt values never use a current quote or new fee defaults. Gross profit is quoted value change of acquired crypto; subtracting all recorded entry and exit costs gives net profit. Gross sale proceeds are before the exit fee.

**No schema/database migration is needed.** Persistence remains v3: its existing execution snapshots already contain the durable receipt inputs, both timestamps and closing reason. The cloud aggregate/journal and transaction protections are unchanged. v1/v2 legacy cost-free records preserve original outcomes and explicitly disclose missing execution details/dates; no historical fees or fills are fabricated. Example history remains separate from simulated funds.

Tests in `tests/paper-receipts.test.mjs` cover review calculations, cent/price precision, realized reconciliation, all three exit reasons, immutable receipts, unchanged v3 restoration, older schema compatibility, quote/mode guards and consumer rendering/history. To test manually: open `/app?demo=1`, choose €100 and +€5, click Buy & Auto-Exit, inspect Estimated before execution, Go Back, then Confirm Paper Trade. Reach target in Demo, inspect the fixed receipt, refresh and find it in Positions. Send proceeds to the simulated bank; the receipt and history remain unchanged. In Live, review estimates follow read-only quotes and Demo controls are absent.

## v0.4.1: Secure the Foundation

[Release checkpoint and external verification checklist](docs/releases/v0.4.1.md).

Authentication now has `/forgot-password`, `/reset-password` and a bounded, same-origin `/api/auth/password` endpoint. Updates verify the request-cookie user and the identity reviewed in the form. Signup, login, logout, session restoration and callback authorization use testable centralized adapters; failed or late auth responses cannot silently unlock an unknown account. Logout is local to the current device; a failed provider revocation is reported separately from confirmed local removal.

A cloud 401 pauses account editing/sync and shows **Sign in to sync** rather than treating it as an ordinary outage. Network failures retain usable validated account data and pending operations. Every cloud write requires a durable local retry journal; storage failure pauses writes rather than sending an unrecorded operation. Invalid account caches are preserved at the account key plus `.invalid` before restoration; if preservation fails, the original remains untouched and writes are paused. Existing recovery copies are retained with unique suffixes when needed; conflict resolution is blocked if its device backup cannot be written. Explicit one-time import remains in place.

No paper schema migration or accounting changes are needed: paper schema v3 and account journal v1 remain compatible. Existing Live/Demo behavior is preserved; no new market source or financial integration is introduced. All trades, cash and bank transfers remain simulated.

### Account activation gate

`NEXT_PUBLIC_QUICKEXIT_ACCOUNTS_ENABLED` defaults to disabled. Supabase URL/key configuration alone never enables accounts. Both browser/server clients and the session proxy stay inactive until the flag is exactly `true`; authentication pages still render and Try Demo works. Do not enable this flag for hosted environments until database requirements, RLS and account isolation are verified and activation is approved. Changes require a rebuild. Existing local paper data is preserved. The public URL/key preflight still validates configuration without contacting Supabase.
