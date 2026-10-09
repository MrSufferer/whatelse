"use client";

import { useEffect, useRef, useState } from "react";
import { createCreationDatafeed } from "~~/utils/launcher/chartDatafeed";

type ChartWidget = { onChartReady: (callback: () => void) => void; remove: () => void };
type TradingViewLibrary = { widget: new (options: object) => ChartWidget };

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
    let widget: ChartWidget | undefined;
    setStatus("loading");
    const script = document.createElement("script");
    script.src = "/charting_library/charting_library.standalone.js";
    script.async = true;
    const fail = () => {
      if (active) setStatus("error");
    };
    const timeout = window.setTimeout(fail, 20_000);
    script.onerror = fail;
    script.onload = () => {
      if (!active || !container.current) return;
      const library = (window as Window & { TradingView?: TradingViewLibrary }).TradingView;
      if (!library) return fail();
      try {
        widget = new library.widget({
          container: container.current,
          library_path: "/charting_library/",
          datafeed: createCreationDatafeed(chainId, address, name, symbol),
          symbol: `${chainId}:${address.toLowerCase()}`,
          interval: "60",
          locale: "en",
          timezone: "Etc/UTC",
          theme: "dark",
          autosize: true,
          disabled_features: ["header_symbol_search", "symbol_search_hot_key", "use_localstorage_for_settings"],
        });
        widget.onChartReady(() => {
          window.clearTimeout(timeout);
          if (active) setStatus("ready");
        });
      } catch {
        fail();
      }
    };
    document.head.appendChild(script);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      script.remove();
      widget?.remove();
    };
  }, [chainId, address, name, symbol, attempt]);

  return (
    <section aria-label={`${symbol} trading chart`}>
      <h2>Price history / ETH</h2>
      <div className="launcher-chart-shell">
        <div ref={container} className="launcher-chart" aria-busy={status === "loading"} />
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
    </section>
  );
}
