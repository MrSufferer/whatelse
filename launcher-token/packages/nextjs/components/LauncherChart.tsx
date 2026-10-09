"use client";

import { useEffect, useRef, useState } from "react";
import type { IChartApi } from "lightweight-charts";

export function LauncherChart({
  chainId,
  address,
  name,
  symbol,
}: {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let chart: IChartApi | undefined;
    setStatus("loading");
    // Load the canvas library only when a registered token detail is mounted.
    void import("lightweight-charts")
      .then(({ createChart, CandlestickSeries, ColorType }) => {
        if (!active || !container.current) return;
        const styles = getComputedStyle(container.current);
        chart = createChart(container.current, {
          autoSize: true,
          layout: {
            background: { type: ColorType.Solid, color: styles.getPropertyValue("--launcher-surface").trim() },
            textColor: styles.getPropertyValue("--launcher-muted").trim(),
            attributionLogo: true,
          },
          grid: {
            vertLines: { color: styles.getPropertyValue("--launcher-border").trim() },
            horzLines: { color: styles.getPropertyValue("--launcher-border").trim() },
          },
          timeScale: { timeVisible: true, secondsVisible: false },
        });
        const series = chart.addSeries(CandlestickSeries, {
          upColor: styles.getPropertyValue("--launcher-mint").trim(),
          downColor: styles.getPropertyValue("--launcher-pink").trim(),
          borderVisible: false,
          wickUpColor: styles.getPropertyValue("--launcher-mint").trim(),
          wickDownColor: styles.getPropertyValue("--launcher-pink").trim(),
          priceFormat: { type: "price", precision: 12, minMove: 0.000000000001 },
        });
        // This immutable creation-only token cannot trade. Supply and preset prices are not OHLC data.
        series.setData([]);
        setStatus("ready");
      })
      .catch(() => {
        chart?.remove();
        chart = undefined;
        if (active) setStatus("error");
      });
    return () => {
      active = false;
      chart?.remove();
    };
  }, [chainId, address, name, symbol, attempt]);

  return (
    <section aria-label={`${symbol} trading chart`}>
      <h2>Price history / ETH</h2>
      <div className="launcher-chart-shell">
        <div
          ref={container}
          className="launcher-chart"
          aria-label={`${name} price history in ETH`}
          aria-busy={status === "loading"}
        />
        {status === "ready" && <div className="launcher-chart-empty">No trades yet</div>}
        {status !== "ready" && (
          <div className="launcher-chart-status" role={status === "error" ? "alert" : "status"}>
            {status === "loading" ? (
              <p>Loading TradingView chart…</p>
            ) : (
              <>
                <p>TradingView chart unavailable.</p>
                <button className="btn" onClick={() => setAttempt(value => value + 1)}>
                  Retry chart
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <p>No trades yet. This creation-only token has no trading history.</p>
      <p className="text-sm">
        TradingView Lightweight Charts™ · Copyright © 2025{" "}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          TradingView, Inc.
        </a>
      </p>
    </section>
  );
}
