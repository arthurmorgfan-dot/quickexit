"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, SeriesType, UTCTimestamp, Time } from "lightweight-charts";
import { chartPoints, movingAverage, withChartGaps, type Candle, type ChartType } from "@/lib/market/models";
import { priceEuro } from "@/lib/demo-trading";

const labels = { line: "Line", candles: "Candlestick", area: "Area", bars: "OHLC bars" };
const utc = (time: number) => new Date(time * 1000).toLocaleString("en-GB", { timeZone: "UTC" });
/** One chart instance per asset/interval. Updating series preserves the user's viewport. */
function PriceChart({ candles, type, granularity, volume, sma20, sma50, asset }: {
  candles: Candle[]; type: ChartType; granularity: number;
  volume: boolean; sma20: boolean; sma50: boolean; asset: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [runtime, setRuntime] = useState<{ chart: IChartApi; library: typeof import("lightweight-charts") } | null>(null);
  const [failed, setFailed] = useState(false);
  const inspection = useRef<HTMLParagraphElement>(null);
  const series = useRef<{ config: string; main: ISeriesApi<SeriesType>; all: ISeriesApi<SeriesType>[]; averages: ISeriesApi<"Line">[]; volume?: ISeriesApi<"Histogram"> } | null>(null);
  const fitted = useRef(false);
  const hasData = useRef(false);
  const averages = useMemo(() => [movingAverage(candles, 20, granularity), movingAverage(candles, 50, granularity)], [candles, granularity]);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void import("lightweight-charts").then(library => {
      if (cancelled || !host.current) return;
      const chart = library.createChart(host.current, {
        width: host.current.clientWidth,
        height: host.current.clientHeight || 280,
        layout: { background: { type: library.ColorType.Solid, color: "#111715" }, textColor: "#a6b4ad", fontFamily: getComputedStyle(host.current).fontFamily, attributionLogo: true },
        grid: { vertLines: { color: "#ffffff08" }, horzLines: { color: "#ffffff08" } },
        rightPriceScale: { borderColor: "#ffffff15" },
        timeScale: { borderColor: "#ffffff15", timeVisible: true, secondsVisible: false },
        localization: { timeFormatter: (time: Time) => typeof time === "number" ? utc(time) : "" },
        crosshair: { mode: library.CrosshairMode.Normal },
        handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
        handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      });
      const resize = new ResizeObserver(entries => {
        const size = entries[0]?.contentRect;
        if (size?.width && size.height) {
          chart.applyOptions({ width: size.width, height: size.height });
          // A collapsed disclosure has zero width: wait for its first visible resize.
          if (!fitted.current && hasData.current) { chart.timeScale().fitContent(); fitted.current = true; }
        }
      });
      resize.observe(host.current);
      // Keep high-frequency pointer updates out of React's chart/data-table render path.
      const inspect = (text: string) => { if (inspection.current) inspection.current.textContent = text; };
      chart.subscribeCrosshairMove(event => {
        const main = series.current?.main;
        const value = main && event.seriesData.get(main);
        if (typeof event.time !== "number") return;
        if (!value) { inspect(`${utc(event.time)} UTC · No observation recorded for this interval.`); return; }
        if ("close" in value) inspect(`${utc(event.time)} UTC · O ${priceEuro(value.open)} · H ${priceEuro(value.high)} · L ${priceEuro(value.low)} · C ${priceEuro(value.close)}`);
        else if ("value" in value) inspect(`${utc(event.time)} UTC · Close ${priceEuro(value.value)}`);
      });
      setRuntime({ chart, library });
      cleanup = () => { resize.disconnect(); chart.remove(); series.current = null; fitted.current = false; hasData.current = false; };
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  useEffect(() => {
    if (!runtime) return;
    const { chart, library } = runtime;
    const config = `${type}:${volume}:${sma20}:${sma50}`;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (series.current?.config !== config) {
      series.current?.all.forEach(s => chart.removeSeries(s));
      const options = { priceLineVisible: false, priceFormat: { type: "custom" as const, formatter: priceEuro, minMove: 0.01 } };
      const main: ISeriesApi<SeriesType> = type === "line"
        ? chart.addSeries(library.LineSeries, { ...options, color: "#96edb9", lineWidth: 2 })
        : type === "area"
          ? chart.addSeries(library.AreaSeries, { ...options, lineColor: "#96edb9", topColor: "#96edb950", bottomColor: "#96edb905", lineWidth: 2 })
          : type === "bars"
            ? chart.addSeries(library.BarSeries, { ...options, upColor: "#96edb9", downColor: "#e99898", thinBars: false })
            : chart.addSeries(library.CandlestickSeries, { ...options, upColor: "#96edb9", downColor: "#e99898", wickUpColor: "#96edb9", wickDownColor: "#e99898", borderVisible: false });
      const overlays: ISeriesApi<"Line">[] = [];
      if (sma20) overlays.push(chart.addSeries(library.LineSeries, { color: "#e5c784", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, title: "SMA 20" }));
      if (sma50) overlays.push(chart.addSeries(library.LineSeries, { color: "#a9a2ee", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, title: "SMA 50" }));
      const volumeSeries = volume ? chart.addSeries(library.HistogramSeries, { priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, 1) : undefined;
      chart.panes()[0]?.setStretchFactor(4);
      chart.panes()[1]?.setStretchFactor(1);
      series.current = { config, main, all: [main, ...overlays, ...(volumeSeries ? [volumeSeries] : [])], averages: overlays, volume: volumeSeries };
    }
    const current = series.current;
    current.main.setData(withChartGaps(chartPoints(candles, type), granularity).map(p => ({ ...p, time: p.time as UTCTimestamp })));
    let index = 0;
    [sma20, sma50].forEach((enabled, i) => {
      if (enabled) current.averages[index++].setData(withChartGaps(averages[i], granularity).map(p => ({ ...p, time: p.time as UTCTimestamp })));
    });
    current.volume?.setData(withChartGaps(candles.map(c => ({ time: c.time, value: c.volume, color: c.close >= c.open ? "#96edb960" : "#e9989860" })), granularity).map(p => ({ ...p, time: p.time as UTCTimestamp })));
    hasData.current = candles.length > 0;
    if (!fitted.current && hasData.current && host.current && host.current.clientWidth > 0) { chart.timeScale().fitContent(); fitted.current = true; }
    else if (fitted.current && range) chart.timeScale().setVisibleLogicalRange(range);
  }, [runtime, candles, type, granularity, volume, sma20, sma50, averages]);
  const zoom = (factor: number) => {
    const scale = runtime?.chart.timeScale(), range = scale?.getVisibleLogicalRange();
    if (!scale || !range) return;
    const center = (range.from + range.to) / 2;
    const half = Math.max(3, (range.to - range.from) * factor / 2);
    scale.setVisibleLogicalRange({ from: center - half, to: center + half });
  };
  return <div className="qw-interactive-chart">
    <div className="qw-chart-axis-labels"><span>Price · EUR</span><span>Time · UTC</span></div>
    {failed ? <p role="status">Interactive chart unavailable. Observed data remains available below.</p> : <div ref={host} role="img" aria-label={`${labels[type]} market price chart in euros. Horizontal drag to pan, pinch or use controls to zoom. Time axis UTC. Use the data list for keyboard inspection.`} />}
    <div className="qw-chart-navigation" role="group" aria-label="Chart zoom controls">
      <button type="button" disabled={!runtime} onClick={() => zoom(0.7)} aria-label="Zoom in">+</button>
      <button type="button" disabled={!runtime} onClick={() => zoom(1.4)} aria-label="Zoom out">−</button>
      <button type="button" disabled={!runtime} onClick={() => runtime?.chart.timeScale().fitContent()}>Fit history</button>
    </div>
    <p ref={inspection} className="qw-chart-inspection">Touch and hold or move over the chart to inspect an observation.</p>
    {volume && <p className="qw-micro">Volume pane · {asset} traded on Coinbase Exchange.</p>}
    {(sma20 || sma50) && <p className="qw-micro">{sma20 ? "SMA 20 (gold)" : ""}{sma20 && sma50 ? " · " : ""}{sma50 ? "SMA 50 (purple)" : ""} · arithmetic mean of contiguous observed closes; restarts after gaps. Insufficient observations leave an overlay empty.</p>}
    <details className="qw-chart-data">
      <summary>Inspect OHLCV as a list</summary>
      <div tabIndex={0} aria-label="Historical prices">
        <table><caption>Observed OHLCV · prices EUR · timestamps UTC</caption>
          <thead><tr><th scope="col">Time</th><th scope="col">Open</th><th scope="col">High</th><th scope="col">Low</th><th scope="col">Close</th><th scope="col">Volume ({asset})</th></tr></thead>
          <tbody>{candles.map(c => <tr key={c.time}><th scope="row">{utc(c.time)}</th><td>{priceEuro(c.open)}</td><td>{priceEuro(c.high)}</td><td>{priceEuro(c.low)}</td><td>{priceEuro(c.close)}</td><td>{c.volume.toLocaleString("en-GB", { maximumFractionDigits: 8 })}</td></tr>)}</tbody>
        </table>
      </div>
    </details>
    <p className="qw-micro">TradingView Lightweight Charts™ · © TradingView, Inc. <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a></p>
  </div>;
}
export default memo(PriceChart);
