/** Public adapter boundary for the creation-only deployment. No trading functions exist. */
export function createCreationDatafeed(chainId: number, address: string, name: string, symbol: string) {
  const ticker = `${chainId}:${address.toLowerCase()}`;
  const resolutions = ["1", "5", "15", "60", "240", "1D"];
  const info = {
    ticker,
    name: ticker,
    description: `${name} (${symbol}) / ETH`,
    type: "crypto",
    session: "24x7",
    timezone: "Etc/UTC",
    exchange: "Launcher",
    listed_exchange: "Launcher",
    format: "price",
    minmov: 1,
    pricescale: 1_000_000_000_000,
    has_intraday: true,
    has_daily: true,
    has_weekly_and_monthly: false,
    supported_resolutions: resolutions,
    volume_precision: 18,
    data_status: "endofday",
  };
  return {
    onReady(callback: (configuration: object) => void) {
      setTimeout(() => callback({ supported_resolutions: resolutions, supports_marks: false, supports_time: false }));
    },
    searchSymbols(_input: string, _exchange: string, _type: string, callback: (results: object[]) => void) {
      setTimeout(() => callback([]));
    },
    resolveSymbol(requested: string, onResolve: (resolved: typeof info) => void, onError: (error: string) => void) {
      setTimeout(() => (requested === ticker ? onResolve({ ...info }) : onError("unknown_symbol")));
    },
    getBars(
      _symbol: object,
      _resolution: string,
      _period: object,
      onHistory: (bars: object[], metadata: { noData: boolean }) => void,
    ) {
      // Zero supply is not a trade. The preset curve must never become invented OHLC history.
      setTimeout(() => onHistory([], { noData: true }));
    },
    // This immutable fixture cannot emit trades; there is no live subscription to maintain.
    subscribeBars() {},
    unsubscribeBars() {},
  };
}
