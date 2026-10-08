import { useState } from "react";
import MobileDisclosure from "./MobileDisclosure";
import { ASSETS, priceEuro, type Asset } from "@/lib/demo-trading";
export function AssetMark({ asset }: { asset: Asset }) {
  return (
    <span
      className={`qw-asset-mark asset-${asset.toLowerCase()}`}
      aria-hidden="true"
    >
      {ASSETS[asset].symbol}
    </span>
  );
}
const paths = {
  "1H": "M0 147 L20 142 L40 153 L60 124 L80 134 L100 123 L120 139 L140 114 L160 123 L180 92 L200 107 L220 94 L240 114 L260 87 L280 95 L300 70 L320 86 L340 61 L360 71 L380 81 L400 56 L420 63 L440 43 L460 55 L480 39 L500 51 L520 32 L540 43 L560 29 L580 38 L600 21",
  "1D": "M0 163 L30 170 L60 135 L90 148 L120 122 L150 144 L180 102 L210 117 L240 93 L270 108 L300 80 L330 97 L360 63 L390 72 L420 48 L450 70 L480 47 L510 61 L540 25 L570 36 L600 21",
  "1W": "M0 151 L30 127 L60 141 L90 123 L120 147 L150 139 L180 114 L210 135 L240 93 L270 114 L300 88 L330 102 L360 74 L390 99 L420 63 L450 80 L480 48 L510 63 L540 37 L570 48 L600 21",
  "1M": "M0 165 L30 143 L60 155 L90 139 L120 162 L150 137 L180 146 L210 99 L240 116 L270 127 L300 92 L330 110 L360 71 L390 87 L420 55 L450 79 L480 41 L510 53 L540 29 L570 41 L600 21",
} as const;
export default function MarketCard({
  asset,
  setAsset,
  locked,
  price,
  live = false,
}: {
  asset: Asset;
  setAsset: (asset: Asset) => void;
  locked: boolean;
  price: number;
  live?: boolean;
}) {
  const [timeframe, setTimeframe] = useState<keyof typeof paths>("1D");
  return (
    <section className="qw-card qw-market" aria-label="Asset market overview">
      <div className="qw-card-heading">
        <label className="qw-overline" htmlFor="asset-choice">
          YOUR ASSET
        </label>
        <span className="qw-badge">
          <span className="status-dot" /> {live ? "LIVE PRICES" : "DEMO PRICES"}
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
        {!live && (
          <span
            className={`qw-market-change ${ASSETS[asset].change < 0 ? "qw-negative" : ""}`}
          >
            {ASSETS[asset].change > 0 ? "+" : ""}
            {ASSETS[asset].change}% <small>illustrative 24h</small>
          </span>
        )}
      </div>
      <div className="qw-price">{priceEuro(price)}</div>
      <MobileDisclosure
        label="Price chart"
        hint="Illustrative market · not live data"
        className="qw-chart-disclosure"
      >
        <div className="qw-chart-toolbar">
          <span>
            Price overview <span>· Mock data</span>
          </span>
          <div aria-label="Chart timeframe">
            {(Object.keys(paths) as (keyof typeof paths)[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={t === timeframe}
                className={t === timeframe ? "is-selected" : ""}
                onClick={() => setTimeframe(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <svg
          viewBox="0 0 600 210"
          className="qw-chart"
          role="img"
          aria-label={`${ASSETS[asset].name} illustrative ${timeframe} price chart. Not live market data.`}
        >
          <defs>
            <linearGradient id="qw-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#96edb9" stopOpacity=".14" />
              <stop offset="100%" stopColor="#96edb9" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 40H600 M0 95H600 M0 150H600 M0 205H600"
            stroke="#ffffff"
            strokeOpacity=".055"
          />
          <path d={`${paths[timeframe]} V210 H0Z`} fill="url(#qw-chart-fill)" />
          <path
            d={paths[timeframe]}
            fill="none"
            stroke="#96edb9"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="600" cy="21" r="4" fill="#96edb9" />
        </svg>
        <div className="qw-chart-axis">
          <span>
            {timeframe === "1H"
              ? "1 hour"
              : timeframe === "1D"
                ? "24 hours"
                : timeframe === "1W"
                  ? "7 days"
                  : "30 days"}{" "}
            ago
          </span>
          <span>Demo now</span>
        </div>
      </MobileDisclosure>
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
