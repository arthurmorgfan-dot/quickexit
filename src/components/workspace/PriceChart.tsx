"use client";
import { useEffect, useRef, useState } from "react";
import { chartPoints, type Candle, type ChartType } from "@/lib/market/models";
import { priceEuro } from "@/lib/demo-trading";
/** Client-only library, resize observer and cleanup support hidden mobile disclosures. */
export default function PriceChart({
  candles,
  type,
}: {
  candles: Candle[];
  type: ChartType;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [inspection, setInspection] = useState(
    "Move over the chart to inspect a price.",
  );
  useEffect(() => {
    if (!host.current || !candles.length) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void import("lightweight-charts").then(
      ({ createChart, LineSeries, CandlestickSeries, ColorType }) => {
        if (cancelled || !host.current) return;
        const chart = createChart(host.current, {
          height: 240,
          layout: {
            background: { type: ColorType.Solid, color: "#111715" },
            textColor: "#a6b4ad",
            fontFamily: getComputedStyle(host.current).fontFamily,
            attributionLogo: true,
          },
          grid: {
            vertLines: { color: "#ffffff08" },
            horzLines: { color: "#ffffff08" },
          },
          rightPriceScale: { borderColor: "#ffffff15" },
          timeScale: {
            borderColor: "#ffffff15",
            timeVisible: true,
            secondsVisible: false,
          },
          localization: { priceFormatter: priceEuro },
          handleScroll: {
            mouseWheel: false,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false,
          },
          handleScale: {
            mouseWheel: false,
            pinch: true,
            axisPressedMouseMove: true,
          },
        });
        const series =
          type === "line"
            ? chart.addSeries(LineSeries, {
                color: "#96edb9",
                lineWidth: 2,
                priceLineVisible: false,
              })
            : chart.addSeries(CandlestickSeries, {
                upColor: "#96edb9",
                downColor: "#e99898",
                wickUpColor: "#96edb9",
                wickDownColor: "#e99898",
                borderVisible: false,
                priceLineVisible: false,
              });
        // Both projections are derived solely from validated OHLCV candles.
        series.setData(
          chartPoints(candles, type) as Parameters<typeof series.setData>[0],
        );
        chart.timeScale().fitContent();
        const resize = new ResizeObserver((entries) => {
          const width = entries[0]?.contentRect.width;
          if (width && width > 0)
            chart.applyOptions({
              width,
              height: entries[0].contentRect.height,
            });
        });
        resize.observe(host.current);
        chart.subscribeCrosshairMove((event) => {
          const value = event.seriesData.get(series);
          if (!value || !event.time) return;
          const close =
            "value" in value
              ? value.value
              : "close" in value
                ? value.close
                : undefined;
          if (close !== undefined && typeof event.time === "number")
            setInspection(
              `${new Date(event.time * 1000).toLocaleString()} · ${priceEuro(close)}`,
            );
        });
        cleanup = () => {
          resize.disconnect();
          chart.remove();
        };
      },
    );
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [candles, type]);
  return (
    <div className="qw-interactive-chart">
      <div
        ref={host}
        role="img"
        aria-label={`${type === "line" ? "Line" : "Candlestick"} market price chart in euros. Use the data list for keyboard inspection.`}
      />
      <p className="qw-micro">{inspection}</p>
      <details className="qw-chart-data">
        <summary>Inspect prices as a list</summary>
        <div tabIndex={0} aria-label="Historical prices">
          <table>
            <caption>Observed market candles · prices in EUR</caption>
            <thead>
              <tr>
                <th>Time</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
              </tr>
            </thead>
            <tbody>
              {candles.map((c) => (
                <tr key={c.time}>
                  <th>{new Date(c.time * 1000).toLocaleString()}</th>
                  <td>{priceEuro(c.open)}</td>
                  <td>{priceEuro(c.high)}</td>
                  <td>{priceEuro(c.low)}</td>
                  <td>{priceEuro(c.close)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="qw-micro">
        TradingView Lightweight Charts™ · © TradingView, Inc.{" "}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          TradingView
        </a>
      </p>
    </div>
  );
}
