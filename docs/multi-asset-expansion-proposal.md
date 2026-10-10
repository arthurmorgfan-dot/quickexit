# QuickExit — Multi-asset expansion proposal

Planning only, researched 10 October 2026. No stock implementation, provider subscription, application configuration change, migration or hosted operation is authorized by this document. The controlled v0.11.5 Demo-preservation context and baseline must remain separate from future development fixtures.

## Recommendation

Keep Coinbase and the existing crypto behavior. Introduce explicit instrument identities and a stock execution eligibility policy around the centralized paper engine. Start with licensed stock discovery and charts; enable simulated stock execution only after quote, exchange-status, FX and corporate-action requirements are satisfied. Delayed data is suitable for clearly labeled discovery, not current-price execution under the requested safeguards.

Shortlist Twelve Data for a single-provider US/European integration, subject to written confirmation of Amsterdam coverage and commercial permissions. Massive is a strong US-only alternative but does not establish coverage of European listings. EODHD is a historical/delayed-discovery candidate, not the recommended execution source without further evidence about its feed provenance and status coverage. No supplier is selected or commercially approved.

## Existing architecture inspected

| Area | Current implementation | Expansion consequence |
| --- | --- | --- |
| Instruments | `src/lib/demo-trading.ts`: BTC, ETH and SOL; euro-denominated amounts; one active position | Add a listing-aware registry rather than adding stock tickers to the crypto constant. Preserve the one-active-position rule initially. Multiple simultaneous positions are a separate accounting change. |
| Execution | `src/lib/paper-execution.ts`: centralized fills, fee rounding, spread/slippage, quantity, realized proceeds and immutable receipt projection | Reuse the engine; introduce currency-aware inputs and validated execution evidence. Do not duplicate arithmetic in a stock component. |
| Quote gating | `src/lib/paper-trading-store.ts`, `market-data.ts`: live buys/sells require fresh provider quotes; current freshness limit is 120 seconds | Stock eligibility needs additional session, halt, entitlement and FX checks. Polling freshness and exchange-event freshness are different. |
| Market data | `src/lib/market/service.ts`, `models.ts`: Coinbase EUR products, ticker/stats/candles, normalization, bounded cache, request coalescing and cooldown | Retain Coinbase adapter; introduce provider-neutral stock capabilities. Existing continuous-time candle gap logic must distinguish expected exchange closures from missing observations. |
| Portfolio | `demo-trading.ts`, `portfolio-performance.ts`: integer-cent cash, estimated liquidation value after exit costs, realized/unrealized P&L, actual-trade statistics | Preserve meanings and rounding; make base/quote currencies explicit. Do not invent historical portfolio value from completed-trade dates. |
| History/receipts | `trading-history.ts`, `TradingHistory.tsx`, `Positions.tsx`: actual/example filters, asset/result/date filters, saved receipts, separate journals, receipt focus return | Add asset-class/listing filters; preserve examples exclusion, saved financial facts and keyboard behavior. |
| Storage/cloud | `paper-trading-storage.ts`, account store/API, migration `202610080001_paper_accounts.sql`: versioned snapshots, isolated Demo/account state, revision/operation IDs | Decoder and database payload validation hard-code crypto assets. Cloud equities cannot be enabled by UI changes alone. Any later migration requires separate review and authorization. |
| Authentication | `account/auth-session.ts`, `account/workspace-store.ts`: uncertain restoration stays locked; initial lookup reconciles events; initialization requires confirmation | Retain these boundaries unchanged. Instrument discovery must not create account records or select/import a starting portfolio. |

Existing tests cover execution costs, receipt preservation, storage restoration, market normalization/freshness, authentication ordering, account isolation, navigation and History filtering. The v0.11.6 review documents responsive History fixtures and receipt focus checks. This planning inspection did not rerun tests or browser reviews and makes no new runtime-verification claim.

The current cloud mechanism persists client-produced paper snapshots with ownership/revision controls; it is not a broker-grade server execution ledger. For a strong stock execution guarantee, validate eligibility at an authoritative application boundary rather than relying only on disabled buttons or a client clock.

## Initial instrument universe

Proposed allowlist:

| Instrument identity | Asset class | Listing | Quote currency | Exchange timezone |
| --- | --- | --- | --- | --- |
| Existing BTC/ETH/SOL EUR instruments | Crypto | Existing Coinbase products | EUR | Continuous market, subject to feed availability |
| `XNAS:AAPL` | Equity | Nasdaq | USD | America/New_York |
| `XNAS:NVDA` | Equity | Nasdaq | USD | America/New_York |
| `XNAS:TSLA` | Equity | Nasdaq | USD | America/New_York |
| `XAMS:ASML` | Equity | Euronext Amsterdam | EUR | Europe/Amsterdam |

ASML confirms both Nasdaq and Amsterdam registered ordinary-share listings. Do not silently substitute the US listing for Amsterdam or call the Nasdaq shares an ADR. If added later, `XNAS:ASML` must be a separate selectable listing with its own currency/calendar/provider mapping. [ASML shares](https://www.asml.com/en/investors/shares)

Registry fields: stable instrument ID, asset class, display symbol/name, MIC, quote currency, IANA timezone, provider symbol, price increment, quantity increment and supported market sessions. Verify each mapping and lot/precision rule before enabling it. Initial orders should be long-only, cash-funded and regular-session only; fractional-share support needs an explicit simulation policy. No shorting, leverage, settlement credit or real brokerage integration.

## Provider comparison

Public pricing is indicative USD pricing, not an approved budget or a quote for QuickExit's exact use. Exchange charges, redistribution, non-display execution use, attribution and retention rights need written confirmation.

| Provider | Coverage and history | Quote limitations | Commercial pricing and permissions | Assessment |
| --- | --- | --- | --- | --- |
| Twelve Data | Business page advertises US and EU real-time data; historical time-series endpoint supports bounded requests. Exact XAMS ASML intervals, depth and latency remain to be verified. | Default US real-time feed represents about 5% of total trading volume, not a consolidated full-market feed. Delayed and historical rights must be confirmed for each venue. | Venture is advertised **from $149/month**; the rendered page also shows a **$499/month** configuration. Enterprise starts at **$1,099/month**. External display is advertised, but US support documentation requires redistribution add-ons for external distribution. Do not assume the headline plan settles all rights. | First cross-region candidate. Obtain a configuration-specific commercial quote and execution/status capability statement. |
| Massive | US equities; business offering includes minute aggregates, historical trades/quotes and corporate actions. European-listed ASML coverage is not established. | Base offering includes derived real-time Fair Market Value. Exchange trade/quote feeds are separate expansions; derived FMV is not automatically an eligible execution quote. Delayed full-market expansion is 15 minutes. | Stocks Business **$2,499/month**. Listed expansions: full-market delayed **+$499/month**, full-market real-time **+$1,999/month**; additional exchange fees/approvals can apply to expansions. Exact external-use rights require contract confirmation. | US candidate if cost is acceptable; would require another approved source for Amsterdam. |
| EODHD | Global delayed snapshots and historical OHLCV. US intraday supports 1m/5m/1h; non-US 1m is not guaranteed. Intraday data is finalized after market close rather than a live candle stream. | Global stock snapshots delayed **15–20 minutes**; FX roughly one minute. Published provenance/accuracy disclaimer makes an execution-source assumption unsafe. | Commercial pricing is **custom quotation**. Personal subscription prices are not commercial permission. | Candidate for licensed historical/discovery data; unsuitable for current-price execution on the evidence reviewed. |

Sources: [Twelve Data business pricing](https://twelvedata.com/pricing-business), [US feed and distribution rights](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data), [commercial usage](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage), [historical requests](https://support.twelvedata.com/en/articles/5214728-getting-historical-data); [Massive business pricing](https://massive.com/business); [EODHD commercial licensing](https://eodhd.com/financial-apis/commercial-vs-personal-license-use), [delayed snapshots](https://eodhd.com/financial-apis/live-ohlcv-stocks-api), [intraday history](https://eodhd.com/financial-apis/intraday-historical-data-api).

Before purchase, obtain written answers covering: exact four listings; real-time versus delayed entitlement; venue/consolidated coverage; bid/ask or eligible trade source; quote timestamps/conditions; market-wide and instrument halts/resumptions; calendars; corporate actions; FX; public and authenticated display; simulated automatic execution/non-display use; caching and derived values; immutable receipt retention after cancellation; user reporting and exchange fees; request limits and attribution. Do not contact suppliers or subscribe without further authorization.

## Proposed data and execution flow

Instrument registry → Coinbase/stock/FX adapters → normalized observations and licensed cache → execution eligibility policy → existing paper arithmetic → immutable fill/receipt → isolated Demo or confirmed account persistence.

Normalized observations must distinguish exchange event time from server receipt time, provider/source, currency, intentional delay, quote type, session, adjustment basis and data quality. Fetching an old quote now must never make it fresh. Keep market timestamps in UTC and interpret sessions in the exchange's IANA timezone.

Use versioned exchange calendars for holidays, early closes and auctions, plus timely instrument trading status. A weekday or calendar-open result alone cannot prove a stock is tradable. Nasdaq publishes regular-session schedules and halt information; Euronext publishes its venue calendars. Restrict QuickExit to the supported regular continuous session even if an exchange adds extended trading. [Nasdaq schedule](https://www.nasdaq.com/market-activity/stock-market-holiday-schedule), [Nasdaq halts](https://www.nasdaqtrader.com/trader.aspx?id=tradinghaltsearch), [Euronext calendars](https://www.euronext.com/en/trading/trading-hours-holidays)

Every buy, manual sell and automatic target/protection exit must pass the same policy at execution time:

- Restored authentication and initialized portfolio, or intentional Demo with a supported local fixture.
- Allowed instrument, supported precision, sufficient simulated cash and valid confirmation/request ID.
- Licensed eligible real-time quote; valid price/conditions; source timestamp within a documented feed-specific limit; no future timestamp or out-of-order replacement.
- Regular session currently open, instrument not halted, current status available, and no unresolved corporate action. Missing status means unavailable, not open.
- Fresh eligible FX observation when quote currency differs from portfolio currency.

Recheck after confirmation. Reject a quote/status/FX change requiring a new estimate; never queue a hidden order or fill at the previous close. On reopening or halt resumption, require a new valid observation. Stops/targets are simulation triggers, not guaranteed prices: a gap may produce an exit beyond the threshold. Cached stale prices may support a clearly labeled last-known valuation, but never execution. If live status cannot be sourced reliably, stocks remain discovery-only.

For cloud orders, plan authoritative eligibility validation with authenticated ownership and idempotency. If using a short-lived server quote ticket, bind it to instrument, observation, expiry and intended order inputs; revalidate session/halt status when consumed. Retain revision-conflict behavior. No new endpoints are implemented now.

## Accounting, receipts and corporate actions

Keep EUR as the proposed portfolio base currency and one cash balance per existing portfolio. Asset class is a reporting dimension, not a second copy of cash. Demo and authenticated accounts remain separate; opening Stocks must not fund or initialize another portfolio.

For USD instruments, record native price/quantity/notional and the USD-to-EUR conversion used separately at entry and exit. Define FX direction, fees and rounding explicitly with fixed-precision arithmetic. Preserve existing crypto cent rounding and saved receipts. Base-currency P&L includes FX effects; distinguish native security return from currency contribution where available. Never sum USD and EUR amounts directly or revalue a completed receipt with today's FX.

Receipt extension: version, instrument/listing/class, quote/base currencies, price source/time/type, quantity, fee-policy snapshot, entry/exit FX and costs, session evidence and recorded reason. Journals remain editable separately from immutable financial facts. Existing receipts retain their original bytes/interpretation; legacy fields are not fabricated.

Corporate actions are a release prerequisite for positions held across sessions. Splits need explicit quantity/cost-basis adjustment events; dividends need separate simulated cash events and treatment distinct from trade win rate. Corrections must not rewrite closed fills. Do not compare adjusted chart prices with unadjusted execution prices. Until an action is understood and processed, block affected trading and mark valuation uncertain. Decide dividend withholding/FX treatment before claiming total-return performance.

Use a backward-compatible schema version and fixtures for legacy crypto snapshots. Unsupported/malformed snapshots must not trigger a newly funded fallback Demo or overwrite recoverable account data. Later cloud migration must update table/function payload validation and reviewed verification expectations together, with explicit authorization and rollback planning. No automatic migration is proposed.

## Unified experience

- Markets: All / Crypto / Stocks filters, listing and currency labels, genuine candles, explicit delayed/stale/closed/halted status. Do not fabricate volume or movement to fill a column.
- Trade: reuse confirmations and fee explanations; show the specific blocking reason and next known opening time. Uninitialized accounts keep the explicit starting-portfolio confirmation gate.
- Portfolio: base-currency total, cash, realized/unrealized P&L; allocation by class/listing where supported. Show last-known/FX-unavailable valuation honestly rather than silently assuming zero.
- History: reuse v0.11.6 rows/cards, journals and receipt focus behavior; add class/listing filters. Actual-trade metrics exclude examples and dividend cash events. Date filters must state their timezone consistently across classes.

## Implementation phases and approval gates

1. **Local foundation:** instrument registry, stock/FX observation contracts, execution policy and calendar fixtures; crypto parity tests. No live stock provider or cloud schema changes. Preserve one active position initially.
2. **Licensed discovery:** after provider/budget/rights approval, add one server-side stock adapter, stock explorer and genuine charts. Keep execution disabled. Verify four listings, timestamps, intervals, rate limits and status coverage. Keys stay server-only.
3. **Demo-only execution:** add currency-aware accounting, class-specific simulated fee policy, fresh FX, session/halts/corporate-action handling and receipt extensions. Test isolated fixtures; no existing Demo baseline or account session is touched.
4. **Cloud readiness:** separately approve backward-compatible storage/schema transition and authoritative order validation. Re-run account isolation, restoration, initialization and immutable receipt checks before any controlled hosted test. No automatic account funding/import.
5. **Controlled release review:** responsive empty/populated/error states, operational limits and rights review; separately approved account tests and deployment. Multiple simultaneous positions, additional venues and extended-hours orders require later scope decisions.

Each phase should have a reviewable diff and acceptance evidence before the next begins. No implementation or deployment approval is implied by this plan.

## Risks and test plan

Highest risks: commercial rights do not match intended use; insufficient real-time halt/quote coverage; stale FX or incorrect currency direction; DST/holiday mistakes; corporate actions corrupt basis; snapshot decoding destroys legacy state; client-only checks provide a weaker guarantee than users expect. Mitigation is explicit capabilities and fail-closed execution, not broader UI claims.

Automated coverage should include:

- **Crypto parity:** all existing fills, fees, quantities, cent rounding, liquidation value, transfers, saved receipts and History statistics unchanged.
- **Identity/providers:** same ticker on two venues; provider aliases; malformed/negative/zero/non-finite prices; quote conditions; throttling/outage/cache expiry; intentional delay; duplicate/out-of-order/future quotes; absent bid/ask; data gaps versus scheduled closure.
- **Sessions:** weekend, holiday, early close, opening/closing boundary, auction, US/Europe DST mismatch weeks, halt/resumption, stale status, calendar outage and reopening without a new quote.
- **Execution:** buy/manual sell/automatic exits all reject closed, halted, unknown, delayed or stale inputs; confirmation-to-fill change; price gaps; invalid quantity increments; insufficient cash; duplicate request IDs and conflicts.
- **Accounting/FX:** EUR and USD fixtures; conversion direction; changing FX at exit; FX fees/rounding; stale/missing FX; balance conservation; realized versus unrealized values; closed receipts independent of later quotes.
- **Corporate actions:** split/dividend timing, adjusted/unadjusted candles, delayed/corrected action events, immutable closed receipts and unknown-action lockout.
- **Persistence/security:** legacy versions retained, unsupported schema recoverable, Demo/account A/account B separation with mocked/local fixtures, no writes during sign-in/restoration/navigation, unavailable auth locked, explicit initialization only, stale-event handling, registration disabled.
- **UI/accessibility:** Markets/Trade/Portfolio/History at 390/768/1440px, empty/example/populated and unavailable states, class filters, labels/currency formatting, receipt keyboard focus and journal independence.

Run the full existing suite, added fixture tests, TypeScript, lint and an isolated production build at implementation time. Keep any new browser contexts and servers separate from the controlled preservation test; block hosted requests during fixture testing. Account/browser/SQL tests remain individually approved future operations.

Next proposed approval: **Phase 1 local instrument-model and eligibility-policy implementation only**, with mocked calendars, quotes and FX. Provider purchasing, live stock requests, cloud persistence changes and controlled account tests remain outside that approval.
