import { useEffect, useState } from "react";
import { ASSETS, priceEuro, type Asset } from "@/lib/demo-trading";
import { fetchMarket } from "@/lib/market/client";
import { normalizeStats, normalizeTicker, dataStatus, type Statistics, type MarketResult } from "@/lib/market/models";
import type { MarketQuote } from "@/lib/market-data";
import { readIntelligence } from "@/lib/market/intelligence-reader";
import { historyLabel, verifiedChange, matchesMovement, type MarketFilter } from "@/lib/market/markets-view";
import type { History, Timeframe } from "@/lib/market/models";
import useMarketIntelligence from "./useMarketIntelligence";
import MarketSparkline from "./MarketSparkline";
import { AssetMark } from "./MarketCard";

type Row = { quote?: MarketResult<MarketQuote>; stats?: MarketResult<Statistics>; error: boolean; history?: MarketResult<History>; historyError?: boolean };
export default function Markets({ onSelect, disabled, activeAsset }: { onSelect: (asset: Asset) => void; disabled: boolean; activeAsset: Asset | null }) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Partial<Record<Asset, Row>>>({});
  const [filter, setFilter] = useState<MarketFilter>("All");
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function poll() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      await Promise.all((Object.keys(ASSETS) as Asset[]).map(async asset => {
        const results = await Promise.allSettled([
          fetchMarket<MarketQuote>(asset, "quote", controller.signal),
          readIntelligence<Statistics>(asset, "stats", controller.signal),
          readIntelligence<History>(asset, "history", controller.signal, "1D"),
        ]);
        if (stopped) return;
        setRows(previous => {
          const row: Row = { ...previous[asset], error: false };
          for (const [i, result] of results.entries()) {
            try {
              if (result.status !== "fulfilled") throw Error("Unavailable");
              if (i === 0) row.quote = { ...result.value, data: normalizeTicker({ price: (result.value.data as MarketQuote).price, time: new Date((result.value.data as MarketQuote).updatedAt).toISOString() }, Date.now()) };
              else if (i === 1) row.stats = { ...result.value, data: normalizeStats(result.value.data) };
              else { row.history = result.value as MarketResult<History>; row.historyError = false; }
            } catch { if (i === 2) row.historyError = true; else row.error = true; }
          }
          return { ...previous, [asset]: row };
        });
      }));
      clearTimeout(timeout);
      if (!stopped) timer = setTimeout(poll, 30000);
    }
    const connection = () => setOffline(!navigator.onLine);
    window.addEventListener("online", connection); window.addEventListener("offline", connection);
    const clock = setInterval(() => setNow(Date.now()), 5000);
    const first = setTimeout(() => { setNow(Date.now()); connection(); void poll(); }, 0);
    return () => { window.removeEventListener("online", connection); window.removeEventListener("offline", connection); stopped = true; clearTimeout(first); clearTimeout(timer); clearInterval(clock); controller?.abort(); };
  }, []);
  const allAssets = Object.keys(ASSETS) as Asset[];
  const assets = allAssets.filter(asset => `${asset} ${ASSETS[asset].name}`.toLowerCase().includes(search.trim().toLowerCase()) && matchesMovement(verifiedChange(rows[asset]?.stats, now, rows[asset]?.error, offline), filter));
  const statuses = allAssets.map(asset => !rows[asset] ? "Loading" : dataStatus(rows[asset]?.quote?.data, !!rows[asset]?.quote?.stale || !!rows[asset]?.error || offline, now));
  const liveCount = statuses.filter(status => status === "Live").length;
  const feedLabel = offline ? "Offline · last known data" : liveCount === 3 ? "Live market data" : statuses.every(s => s === "Loading") ? "Connecting to Coinbase…" : `${liveCount}/3 fresh prices · ${statuses.includes("Stale") ? "stale data" : "delayed or unavailable"}`;
  return <section className="qm-markets" aria-label="Cryptocurrency markets">
    <div className="qm-feed"><span className={liveCount === 3 && !offline ? "qm-live" : ""} role="status"><i aria-hidden="true" />{feedLabel}</span><span className="qm-currency">€ EUR</span></div>
    <div className="qm-featured">{allAssets.map(asset => <FeaturedMarket key={asset} asset={asset} row={rows[asset]} now={now} offline={offline} />)}</div>
    {activeAsset && <p className="qw-market-status">Your {activeAsset} paper position is open. Trade returns to that position; your next asset choice is remembered.</p>}
    <div className="qm-discovery"><label className="qm-search"><span className="sr-only">Search cryptocurrencies</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cryptocurrencies (Bitcoin, ETH, SOL…)" /></label><div className="qm-filters" role="group" aria-label="Market filters">{(["All", "Gainers", "Losers"] as const).map(f => <button type="button" key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div></div>
    <div className="qm-table-wrap"><table className="qm-table"><caption className="sr-only">Supported cryptocurrency markets · EUR prices</caption><thead><tr><th scope="col">Asset</th><th scope="col">Price</th><th scope="col">24h Change</th><th scope="col">24h Chart</th><th scope="col">Action</th></tr></thead><tbody>{assets.map(asset => {
      const row = rows[asset], quote = row?.quote;
      const status = !row ? "Loading" : dataStatus(quote?.data, !!quote?.stale || !!row.error || offline, now);
      const change = verifiedChange(row?.stats, now, row?.error, offline);
      const label = historyLabel(row?.history, now, "1D", row?.historyError, offline);
      return <tr key={asset}><th scope="row"><span className="qw-table-asset"><AssetMark asset={asset} /><span><strong>{ASSETS[asset].name}</strong><small>{asset}</small></span></span></th><td><strong>{quote ? priceEuro(quote.data.price) : "—"}</strong><small>{status}{quote && ` · ${new Date(quote.data.updatedAt).toLocaleTimeString()}`}</small></td><td className={change === undefined ? "" : change < 0 ? "qm-down" : "qm-up"}>{change === undefined ? "Unavailable" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}</td><td className="qm-table-chart"><MarketSparkline history={row?.history} label={`${ASSETS[asset].name} · 24h · ${label}`} loading={!row} /><small>{label}</small></td><td><button type="button" className="qm-trade" aria-label={`Trade ${ASSETS[asset].name} ${asset}`} disabled={disabled} onClick={() => onSelect(asset)}>Trade <span aria-hidden="true">↗</span></button></td></tr>;
    })}</tbody></table>{!assets.length && <p className="qw-empty" role="status">No supported assets match your search or filter. Movement filters require fresh 24h statistics.</p>}</div>
    <div className="qm-source"><span>Coinbase Exchange · real EUR market data</span><span>3 supported markets · BTC, ETH, SOL</span></div>
    <p className="qw-micro">Real market prices. Simulated trades and balances. Charts show observed candle closes with missing intervals left empty. XRP, ADA and DOGE are unsupported.</p>
  </section>;
}
function FeaturedMarket({ asset, row, now, offline }: { asset: Asset; row?: Row; now: number; offline: boolean }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const data = useMarketIntelligence(asset, timeframe, timeframe !== "1D");
  const history = timeframe === "1D" ? row?.history : data.history;
  const label = historyLabel(history, now, timeframe, timeframe === "1D" ? row?.historyError : data.historyError, offline);
  const change = verifiedChange(row?.stats, now, row?.error, offline);
  const status = !row ? "Loading" : dataStatus(row.quote?.data, !!row.quote?.stale || row.error || offline, now);
  return <article className="qm-feature" aria-label={`${ASSETS[asset].name} featured market`}><div className="qw-table-asset"><AssetMark asset={asset} /><div><h2>{ASSETS[asset].name}</h2><small>{asset} / EUR</small></div></div><div className="qm-feature-body"><div><strong className="qm-price">{row?.quote ? priceEuro(row.quote.data.price) : "—"}</strong><p className={change === undefined ? "qm-muted" : change < 0 ? "qm-down" : "qm-up"}>{change === undefined ? "24h change unavailable" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% (24h)`}</p></div><MarketSparkline history={history} label={`${ASSETS[asset].name} · ${timeframe} · ${label}`} loading={timeframe === "1D" ? !row : data.loading} /></div><div className="qm-ranges" role="group" aria-label={`${asset} history range`}>{(["1H", "1D", "1W", "1M", "1Y"] as const).map(t => <button type="button" key={t} aria-pressed={timeframe === t} onClick={() => setTimeframe(t)}>{t}</button>)}</div><p className="qm-observation">{status}{row?.quote && ` · ${new Date(row.quote.data.updatedAt).toLocaleTimeString()}`}<br />{label}{history && ` · ${history.data.gaps} missing intervals`}</p></article>;
}
