# TradingView Advanced Charts

The creation walkthrough requested Advanced Charts with our own datafeed and its full chart interface, replacing the SVG price-versus-supply diagram. The fixed economics remain in the separate disclosures. The detail page now loads the official local Advanced Charts distribution, keeps drawing tools and indicators enabled, and disables switching to unrelated symbols. Identity is chain ID plus token contract address, rather than the non-unique token symbol.

## Library access prerequisite

Request access from [TradingView Advanced Charts](https://www.tradingview.com/advanced-charts/). The authenticated GitHub account returned 404 for `tradingview/charting_library` during this implementation; the licensed library is not installed. Download only from the official repository after access is granted. Place its complete `charting_library` directory in `packages/nextjs/public/charting_library/`, including `charting_library.standalone.js` and all companion assets. This directory is gitignored: TradingView prohibits redistributing the library in public repositories. Supply these files privately when building a hosted application too.

The running application displays a recoverable chart-unavailable state until the files are supplied. It does not embed the hosted widget, borrow another market's candles, load a third-party copy, or claim the full TradingView interface has been verified. Localhost is a development preview; review TradingView's access terms for the eventual hosted application.

## Datafeed scope

`createCreationDatafeed` implements the Advanced Charts initialization, symbol resolution, history and subscription boundary for this immutable creation-only fixture. Historical reads return an empty bar list with `noData: true`; live subscription methods emit nothing because this token has no mint, buy or sell functions. The UI says “No trades yet.” Zero supply, the preset starting price and the mathematical curve are never converted into fictional candles.

This is not a trading-history ingestion implementation. A separately reviewed trading deployment must replace this adapter with canonical OHLCV history and subscriptions sourced from its own trades, with reorg reconciliation and error reporting, before presenting live prices. This fixture cannot acquire trading capability through an upgrade.

## Walkthrough status

The owner accepted the creation flow with the chart correction. Base Sepolia creation transaction `0x21ff59fdb030cdb10b018b596a9daf0e68fa877b6fbabe012913078e2dcd6f8d` emitted token `0x79B5d6c59cF6084a9466E9791F8752235a5826f1` from factory `0xe1de5ce3f5cee13ade3ff209e30928dac15ff3db`; direct reads verified FTEST, zero supply, and the approved Launcher/recipients. Rejected-proposal human review and visual acceptance of the real licensed chart remain outstanding. The walkthrough ticket stays open.

References: [widget data restrictions](https://www.tradingview.com/widget-docs/faq/data/), [official library access](https://www.tradingview.com/charting-library-docs/v29/getting_started/quick-start/), [datafeed methods](https://www.tradingview.com/charting-library-docs/v29/connecting_data/datafeed-api/required-methods/).

## Verification

Typechecking and frontend lint passed. All seven existing Foundry tests passed, including 1,000 unauthorized-wallet fuzz runs. Direct adapter checks verified exact chain/address resolution, rejection of an ambiguous symbol, and empty history with `noData: true`. Real Chromium displayed the registered FTEST detail, the no-trades message, and a chart-unavailable state with retry; there was no horizontal overflow at 375px, 768px or 1280px. The missing library script produces an expected HTTP 404. Actual TradingView rendering, drawing tools, indicators and runtime type compatibility cannot be verified until official assets are installed.

Independent Standards review plus the original Grumpy Carlos review found no material violations. Spec review recorded one known partial requirement: the full interface awaits licensed assets. Official distribution types should replace the small local integration declarations once available. No production build or deployment was performed for this correction.
