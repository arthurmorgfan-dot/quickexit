# QuickExit

A responsive public landing page for the QuickExit crypto trading concept: **Trade it. Profit. Send it home.**

## Run locally

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

This is a product concept only. All market figures are mock data. There is no authentication, trading backend, payment processing, or partner integration. Get Started and Start Trading lead to the simulated `/app` workspace; Sign in leads to the availability notice. Privacy and Terms describe this prototype rather than a future live service.

## Production identity

The canonical landing URL is `https://quickexit.net/`. Homepage metadata includes Open Graph and X/Twitter cards. `/opengraph-image` generates a static 1200×630 PNG during the build. `/robots.txt` permits public crawling and points to `/sitemap.xml`, which lists only the landing URL.

QuickExit provides an SVG browser icon, a multi-resolution ICO favicon, and a 180×180 Apple touch icon. Unmatched routes use the branded `not-found.tsx` page with a home link and the prototype/risk notice; Next.js adds `noindex` to the 404.

Landing anchor navigation opens linked prototype disclosures, moves keyboard focus to the destination, and handles repeated clicks and direct hash URLs. The mobile menu supports Escape and closes on desktop resize. Animations and smooth scrolling respect reduced-motion preferences.


## Phase two: desktop workspace

`/app` is a responsive client-side trading prototype. Its sidebar contains Home, Trade, Positions, Activity, Cash Out, and Settings views, all within the same route and shared local paper-trading state. BTC is selected by default; ETH and SOL are also supported with mock prices. The existing landing page keeps its visual design and links its primary CTAs to `/app`.

To test the full flow:

1. Open `/app`. Leave the default €100 amount, +€5 target, and enabled auto-exit. Click **Buy & Auto-Exit**.
2. Pause **Subtle price movement** for exact, repeatable values. Click **Profit rises**: the position shows +€3.82 / 76% (if no tick occurred before pausing).
3. Click **Reach target**: the position closes automatically at +€5 and makes €105 available.
4. Click **Send to Bank**, then **Send €105.00 to Bank**. The placeholder account is •••• 4821. The screen confirms €105 sent home, and available cash returns to zero.
5. Explore Positions and Activity to see the completed trade and readable event history.

For other scenarios, choose protection before opening a trade and use **Profit falls**. **Sell Now** closes at the current simulated profit/loss. **Edit Target** updates an active target; lowering it to or below current profit closes immediately when auto-exit is enabled. Disable auto-exit before buying to monitor and sell manually. Amount, target, and protection support validated custom values. Percentage targets show their euro equivalent.

Mock prices move deterministically every four seconds while a position is active. Reduced-motion preferences pause movement by default; it can be enabled deliberately. Settings includes a session reset. Paper-trading state is saved locally on this device and survives refresh. Historical BTC/ETH/SOL examples are labeled and excluded from the session’s balances. There are no requests to financial APIs, real transactions, or banking forms. `/app` is marked `noindex` and excluded from the sitemap.

Workspace components are in `src/components/workspace/`, scoped styles in `src/app/app/workspace.css`, and the simulation reducer in `src/lib/demo-trading.ts`. Financial amounts use integer cents. Run `npm test` for the simulation’s accounting and lifecycle checks, alongside the lint, TypeScript, and production build checks.


## Mobile workspace

At viewport widths of 700px and below, `/app` uses a dedicated mobile layout. Five safe-area-aware bottom-navigation buttons open Trade, Positions, Activity, Cash Out, and Settings; the header Home button opens the overview. The desktop layout and simulation reducer are unchanged.

The active trade and completed-trade result appear before market information. Current profit, euro target, progress, invested value, auto-exit status, Sell Now, and Edit Target remain prominent. Price charts, market information after buying, optional protection, position details, and demo controls use accessible expandable sections. Positions use stacked cards instead of a scrolling table. Numeric inputs use 16px text and decimal keyboards, and the bottom navigation hides while an input has focus.

To test on a phone or a narrow responsive viewport (try 320, 390, 430, and 700px):

1. Open `/app`, use bottom-nav Settings to pause subtle price movement, and return to Trade.
2. Keep €100 / +€5 / auto-exit on and tap Buy & Auto-Exit. The profit card replaces the form and is brought into view.
3. Expand **Try a demo outcome**, tap **Profit rises**, then **Reach target**. Check +€3.82 / 76%, followed by the target-reached result.
4. Tap **Send to Bank** and the simulated transfer action. Verify €105 sent home and €0 available.
5. Inspect Positions, Activity, and Settings through bottom navigation. Test Edit Target, custom numeric fields, protection, and disclosures. Resize above 700px to verify the original desktop layout remains available.

All transactions are simulated. No real accounts, banking data, payments, or APIs are used.


## Persistent local paper trading

`src/lib/paper-trading-storage.ts` owns the `quickexit.paper-trading` localStorage key and version 1 schema. It serializes an explicit durable snapshot: selected asset, active/completed positions, last result/transfer, cash, sent-home total, activity, sequence/tick counters, and price-movement preference. Position price is derived from persisted entry price and profit, so there is no divergent duplicate price field. Editor drafts, current view, confirmations, disclosures, and live-region announcements are not saved.

Restoration validates types, assets, cents, price bounds, position/exit consistency, unique IDs, and the cash-plus-sent ledger against real demo trade proceeds. Unknown properties are discarded; sample history is canonical and excluded from balances. Malformed data or unsupported versions start a clean demo with a recovery notice. Browser storage errors leave a usable temporary demo and a truthful “Not saved on this device” status.

`src/lib/paper-trading-store.ts` manages hydration, immediate saves after domain actions, and reset. `usePersistentDemo.ts` connects it to React with `useSyncExternalStore`: SSR and initial client hydration share the same stable initial snapshot, storage is read only after mount, controls stay inert until restoration, and price movement starts only afterward. No offline price catch-up occurs. Explicit saved movement preferences survive refresh; fresh/reset demos respect reduced-motion defaults. Other tabs on the same origin synchronize through storage events. This is device-local storage, not an account or cloud sync; concurrent edits use the last saved snapshot.

Settings → **Reset demo** opens an explicit confirmation before removing the owned key and restoring BTC, zero cash/sent totals, welcome activity, default settings, and the initial illustrative history. Cancellation does not modify storage. The next reload restores the clean initial demo. Unrelated localStorage keys are never cleared.

Refresh test: reset the demo, pause price movement in Settings, buy €100 BTC with a +€5 target, and refresh. Reach the target and refresh again: the closed position and €105 remain. Send €105 to the demo bank and refresh: cash stays €0, sent-home total is €105, and the activity record remains. Confirm Reset demo and refresh to verify a clean initial state. Run `npm test` for both simulation and persistence tests.
