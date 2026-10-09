# TradingView Lightweight Charts

The owner selected Lightweight Charts as the immediate implementation after restricted Advanced Charts access was unavailable. Version 5.2.0 is installed in the frontend workspace and dynamically imported when registered token detail mounts. The actual canvas uses the accepted graphite/mint/pink theme, responsive sizing, ETH price precision, and TradingView attribution. Cleanup removes the chart on navigation; initialization failure offers retry.

The custom SVG mathematical price-versus-supply diagram is removed. Economics remain in separate disclosures. Lightweight Charts does not provide the full Advanced Charts drawing/indicator interface. Advanced Charts remains a possible later integration requiring official access; no restricted assets are needed here.

## Data scope

The immutable creation-only fixture has no trading functions or trading history. Its candlestick series receives an empty dataset and displays “No trades yet.” Supply, creation transactions and preset prices never become invented candles. A separately reviewed trading deployment must supply canonical OHLCV history and updates with reorg reconciliation before presenting live prices. This token cannot gain trading capability through an upgrade.

The existing token detail registry/read boundary shows the chart only for registered tokens. Chart state resets when chain/token identity changes. No unrelated market feed is loaded.

## Walkthrough status

The owner accepted creation with the chart correction. Base Sepolia creation transaction `0x21ff59fdb030cdb10b018b596a9daf0e68fa877b6fbabe012913078e2dcd6f8d` emitted token `0x79B5d6c59cF6084a9466E9791F8752235a5826f1` from factory `0xe1de5ce3f5cee13ade3ff209e30928dac15ff3db`; direct reads verified FTEST, zero supply and approved Launcher/recipients. Visual acceptance and rejected-proposal human review remain outstanding. The ticket stays open.

References: [Lightweight Charts](https://github.com/tradingview/lightweight-charts), [version attribution notice](https://github.com/tradingview/lightweight-charts/blob/v5.2.0/NOTICE).

## Verification

Frontend typechecking and lint passed. All seven existing contract tests passed, including 1,000 fuzz runs. Real Chromium rendered seven chart canvases, the no-trades empty state and visible attribution, with zero browser errors and no horizontal overflow at 375px, 768px and 1280px. Independent Standards/Grumpy Carlos and Spec reviews found no material findings. Production deployment and the human rejection walkthrough were not performed.
