# TradingView Lightweight Charts

The owner selected Lightweight Charts as the immediate implementation after restricted Advanced Charts access was unavailable. Version 5.2.0 is installed in the frontend workspace and dynamically imported only when token detail has candles to display. The actual canvas uses the accepted graphite/mint/pink theme, responsive sizing, ETH price precision, and TradingView attribution. Cleanup removes the chart on navigation; initialization failure offers retry.

When no candles are available, the original SVG mathematical price-versus-supply diagram is shown as a clearly labelled placeholder, without loading the canvas library. When canonical candles are supplied, Lightweight Charts displays price history. Economics remain in separate disclosures. Lightweight Charts does not provide the full Advanced Charts drawing/indicator interface. Advanced Charts remains a possible later integration requiring official access; no restricted assets are needed here.

## Data scope

The immutable creation-only fixture has no trading functions or trading history. The fixture supplies no candles and displays the original curve with “No trades yet” and an explicit mathematical-curve disclaimer. Supply, creation transactions and preset prices never become invented candles. A separately reviewed trading deployment must supply canonical OHLCV history and updates with reorg reconciliation before presenting live prices. This token cannot gain trading capability through an upgrade.

The existing token detail registry/read boundary shows the chart only for registered tokens. Chart state resets when chain/token identity changes. No unrelated market feed is loaded.

## Walkthrough status

The owner accepted creation with the chart correction. Base Sepolia creation transaction `0x21ff59fdb030cdb10b018b596a9daf0e68fa877b6fbabe012913078e2dcd6f8d` emitted token `0x79B5d6c59cF6084a9466E9791F8752235a5826f1` from factory `0xe1de5ce3f5cee13ade3ff209e30928dac15ff3db`; direct reads verified FTEST, zero supply and approved Launcher/recipients. Visual acceptance and rejected-proposal human review remain outstanding. The ticket stays open.

References: [Lightweight Charts](https://github.com/tradingview/lightweight-charts), [version attribution notice](https://github.com/tradingview/lightweight-charts/blob/v5.2.0/NOTICE).

## Verification

Frontend typechecking and lint passed. All seven existing contract tests passed, including 1,000 fuzz runs. Before the placeholder change, real Chromium verified the Lightweight Charts canvas and attribution. After the change, Chromium verified one original curve SVG, zero canvases, the mathematical-curve disclaimer, zero browser errors and no horizontal overflow at 375px, 768px and 1280px. Independent Standards/Grumpy Carlos and Spec reviews found no material findings. Production deployment and the human rejection walkthrough were not performed.

## Remaining human checks

Accept the restored placeholder on the existing zero-supply detail. For the rejected-proposal case, use a fresh operator factory, approve the launcher, then choose Prepare proposal rejection and sign in MetaMask. Do not use the consumed proposal in the existing factory. Send the fresh factory address and deployment/approval/rejection hashes so the agent can verify rejection and configure Create against that factory. On Create, verify creation is disabled and no wallet signing prompt is offered, then record acceptance or corrections. This isolates proposal rejection from an unauthorized launcher and consumed-proposal state. No fresh deployment has been performed by the agent.
