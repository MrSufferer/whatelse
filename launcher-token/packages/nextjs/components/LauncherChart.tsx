"use client";

import { useEffect, useRef, useState } from "react";
import type { CandlestickData, IChartApi } from "lightweight-charts";

type LauncherChartProps = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  candles?: CandlestickData[];
};

export function LauncherChart(props: LauncherChartProps) {
  if (!props.candles?.length)
    return (
      <section aria-label={`${props.symbol} bonding curve placeholder`}>
        <h2>Permanent linear preset</h2>
        <svg
          className="curve"
          role="img"
          aria-label="Mathematical preset: marginal price rises linearly from 0.000001 ETH at zero supply to 0.000019 ETH at one million tokens"
          viewBox="0 0 600 260"
        >
          <path d="M50 20V220H580" fill="none" stroke="currentColor" />
          <path d="M50 210L570 30" fill="none" stroke="var(--launcher-mint)" strokeWidth="3" />
          <text x="55" y="245">
            0 tokens
          </text>
          <text x="420" y="245">
            1,000,000 tokens
          </text>
          <text x="60" y="30">
            Marginal price / supply
          </text>
        </svg>
        <p>No trades yet. Showing the mathematical price curve, not trading history or a forecast.</p>
      </section>
    );
  return <PriceHistoryChart {...props} candles={props.candles} />;
}

function PriceHistoryChart({
  chainId,
  address,
  name,
  symbol,
  candles,
}: LauncherChartProps & { candles: CandlestickData[] }) {
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
        series.setData(candles);
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
  }, [chainId, address, name, symbol, candles, attempt]);

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
      <p className="text-sm">
        TradingView Lightweight Charts™ · Copyright © 2025{" "}
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          TradingView, Inc.
        </a>
      </p>
    </section>
  );
}
