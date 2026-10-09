import { useEffect, useState } from "react";
import { ASSETS, priceEuro, type Asset } from "@/lib/demo-trading";
import { fetchMarket } from "@/lib/market/client";
import { normalizeStats, normalizeTicker, dataStatus, type Statistics, type MarketResult } from "@/lib/market/models";
import type { MarketQuote } from "@/lib/market-data";
import { AssetMark } from "./MarketCard";

type Row = { quote?: MarketResult<MarketQuote>; stats?: MarketResult<Statistics>; error: boolean };
export default function Markets({ onSelect, disabled, activeAsset }: { onSelect: (asset: Asset) => void; disabled: boolean; activeAsset: Asset | null }) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Partial<Record<Asset, Row>>>({});
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
          fetchMarket<Statistics>(asset, "stats", controller.signal),
        ]);
        if (stopped) return;
        setRows(previous => {
          const row: Row = { ...previous[asset], error: false };
          for (const [i, result] of results.entries()) {
            try {
              if (result.status !== "fulfilled") throw Error("Unavailable");
              if (i === 0) row.quote = { ...result.value, data: normalizeTicker({ price: (result.value.data as MarketQuote).price, time: new Date((result.value.data as MarketQuote).updatedAt).toISOString() }, Date.now()) };
              else row.stats = { ...result.value, data: normalizeStats(result.value.data) };
            } catch { row.error = true; }
          }
          return { ...previous, [asset]: row };
        });
      }));
      clearTimeout(timeout);
      if (!stopped) timer = setTimeout(poll, 30000);
    }
    const clock = setInterval(() => setNow(Date.now()), 5000);
    const first = setTimeout(() => { setNow(Date.now()); void poll(); }, 0);
    return () => { stopped = true; clearTimeout(first); clearTimeout(timer); clearInterval(clock); controller?.abort(); };
  }, []);
  const assets = (Object.keys(ASSETS) as Asset[]).filter(asset => `${asset} ${ASSETS[asset].name}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="qw-card qw-markets">
    <div className="qw-card-heading"><h2>Find your next trade</h2><span className="qw-badge">REAL MARKETS · PAPER TRADES</span></div>
    <p className="qw-micro">Coinbase Exchange · EUR prices. Your balances, fees and executions are simulated.</p>
    {activeAsset && <p className="qw-market-status">Your {activeAsset} paper position is open. Selecting a market returns to that position and remembers your choice for the next trade.</p>}
    <label className="qw-market-search">Search cryptocurrencies<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Bitcoin, ETH…" /></label>
    <ul className="qw-market-list">{assets.map(asset => {
      const row = rows[asset], quote = row?.quote;
      const status = !row ? "Loading" : dataStatus(quote?.data, !!quote?.stale || !!row.error, now);
      const stats = row?.stats;
      const change = stats && !stats.stale && now - stats.fetchedAt <= 120000 && !row?.error ? stats.data.change : undefined;
      return <li key={asset}><button type="button" disabled={disabled} onClick={() => onSelect(asset)}>
        <span className="qw-table-asset"><AssetMark asset={asset} /><span><strong>{ASSETS[asset].name}</strong><small>{asset} / EUR</small></span></span>
        <span className="qw-market-row-price"><strong>{quote ? priceEuro(quote.data.price) : "—"}</strong><small>{change === undefined ? "24h change unavailable" : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% · 24h`}</small></span>
        <span className="qw-market-row-status"><strong>{status}</strong><small>{quote ? new Date(quote.data.updatedAt).toLocaleTimeString() : row ? "Try again shortly" : "Fetching prices…"}</small></span>
      </button></li>;
    })}</ul>
    {!assets.length && <div className="qw-empty">No supported assets match your search.</div>}
    <p className="qw-micro">BTC, ETH and SOL supported. XRP, ADA and DOGE are not available in this workspace.</p>
  </section>;
}
