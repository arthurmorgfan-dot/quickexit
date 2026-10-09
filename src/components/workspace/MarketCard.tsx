import { useEffect, useState } from "react";
import MobileDisclosure from "./MobileDisclosure";
import { ASSETS, priceEuro, type Asset } from "@/lib/demo-trading";
import type { MarketQuote, MarketStatus } from "@/lib/market-data";
import {
  TIMEFRAMES,
  dataStatus,
  type Timeframe,
  type ChartType,
} from "@/lib/market/models";
import useMarketIntelligence from "./useMarketIntelligence";
import PriceChart from "./PriceChart";
export function AssetMark({ asset }: { asset: Asset }) {
  return (
    <span
      className={`qw-asset-mark asset-${asset.toLowerCase()}`}
      aria-hidden="true"
    >
      {asset === "SOL" ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 4h17l-3 4H2zM2 10h17l3 4H5zM5 16h17l-3 4H2z" /></svg> : ASSETS[asset].symbol}
    </span>
  );
}
export default function MarketCard({
  asset,
  setAsset,
  locked,
  price,
  live = false,
  quote,
  connection,
}: {
  asset: Asset;
  setAsset: (asset: Asset) => void;
  locked: boolean;
  price: number;
  live?: boolean;
  quote?: MarketQuote;
  connection?: MarketStatus;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D"),
    [type, setType] = useState<ChartType>("line"),
    [now, setNow] = useState(0);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 15000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const data = useMarketIntelligence(asset, timeframe, live);
  const status = live
    ? now
      ? dataStatus(quote, connection === "unavailable", now)
      : "Connecting"
    : "Demo";
  const stats = data.stats?.data,
    history = data.history?.data;
  const statsStale =
    data.stats?.stale ||
    data.error ||
    (!!data.stats && now - data.stats.fetchedAt > 120000);
  return (
    <section className="qw-card qw-market" aria-label="Asset market overview">
      <div className="qw-card-heading">
        <label className="qw-overline" htmlFor="asset-choice">
          YOUR ASSET
        </label>
        <span className="qw-badge">
          <span className="status-dot" />
          {status.toUpperCase()} PRICES
        </span>
      </div>
      <div className="qw-market-top">
        <div className="qw-asset-name">
          <AssetMark asset={asset} />
          <div>
            <h2>
              {ASSETS[asset].name}
              <span>{asset}</span>
            </h2>
            <select
              id="asset-choice"
              value={asset}
              disabled={locked}
              onChange={(e) => setAsset(e.target.value as Asset)}
            >
              {Object.entries(ASSETS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.name} / {key}
                </option>
              ))}
            </select>
          </div>
        </div>
        {stats && live ? (
          <span
            className={`qw-market-change ${stats.change < 0 ? "qw-negative" : ""}`}
          >
            {stats.change >= 0 ? "+" : ""}
            {stats.change.toFixed(2)}%
            <small>24h {statsStale ? "· last known" : ""}</small>
          </span>
        ) : !live ? (
          <span className="qw-market-change">
            Demo<small>simulated outcomes</small>
          </span>
        ) : null}
      </div>
      <div className="qw-price">{priceEuro(price)}</div>
      <p className="qw-micro" role="status">
        {live
          ? quote
            ? `${status} · Coinbase Exchange · indicative last trade`
            : "Awaiting verified quote · Demo reference price shown"
          : "Demo price · all trading remains simulated"}
      </p>
      <MobileDisclosure
        label="Price chart"
        hint={
          live ? "Observed market history" : "Switch to Live for market history"
        }
        className="qw-chart-disclosure"
      >
        <div className="qw-chart-toolbar">
          <div role="group" aria-label="Chart type">
            {(["line", "candles"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                className={type === t ? "is-selected" : ""}
                onClick={() => setType(t)}
              >
                {t === "line" ? "Line" : "Candles"}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Chart timeframe">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={timeframe === t}
                className={timeframe === t ? "is-selected" : ""}
                onClick={() => setTimeframe(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {!live ? (
          <div className="qw-history-empty">
            Market charts use real observations.
            <small>
              Choose Live in Settings to explore history. Demo controls remain
              deterministic.
            </small>
          </div>
        ) : history?.candles.length ? (
          <>
            <PriceChart candles={history.candles} type={type} />
            <p className="qw-micro" role="status">
              {data.history?.stale || data.error
                ? "Last known history · refresh unavailable"
                : data.loading
                  ? "Refreshing history…"
                  : "Observed OHLCV"}{" "}
              · {history.granularity / 60}-minute candles
              {history.gaps > 0 ? ` · ${history.gaps} missing intervals` : ""}.
              Empty intervals are not filled.
            </p>
          </>
        ) : (
          <div className="qw-history-empty" role="status">
            {data.loading
              ? "Loading market history…"
              : "History unavailable for this range."}
            <small>No substitute prices are generated.</small>
          </div>
        )}
      </MobileDisclosure>
      <dl className="qw-market-statistics">
        <div>
          <dt>24h volume</dt>
          <dd>
            {live && stats
              ? `${new Intl.NumberFormat("en", { maximumFractionDigits: 2, notation: "compact" }).format(stats.volume)} ${asset}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>24h high</dt>
          <dd>{live && stats ? priceEuro(stats.high) : "—"}</dd>
        </div>
        <div>
          <dt>24h low</dt>
          <dd>{live && stats ? priceEuro(stats.low) : "—"}</dd>
        </div>
        <div>
          <dt>Last quote</dt>
          <dd>
            {live && quote
              ? new Date(quote.updatedAt).toLocaleTimeString()
              : "Demo"}
          </dd>
        </div>
      </dl>
      {live && (
        <p className="qw-micro">
          {stats
            ? `Statistics ${statsStale ? "stale · " : ""}received ${new Date(data.stats!.fetchedAt).toLocaleTimeString()}. Volume is ${asset} traded on Coinbase, not global volume.`
            : data.loading
              ? "Loading market statistics…"
              : "Market statistics unavailable."}{" "}
          Prices do not guarantee a simulated fill.
        </p>
      )}
      <div className="qw-market-foot">
        <span>
          Less chart-watching.
          <br />
          <strong>More knowing your next move.</strong>
        </span>
        <span className="qw-market-arrow" aria-hidden="true">
          ↗
        </span>
      </div>
      {locked && (
        <p className="qw-micro">
          Your position’s asset stays fixed until the trade closes.
        </p>
      )}
    </section>
  );
}
