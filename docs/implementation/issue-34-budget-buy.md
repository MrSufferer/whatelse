# ETH budget buys — issue 34

This is an implementation and local verification slice of [ticket 34](https://github.com/MrSufferer/whatelse/issues/34), not completion of its parent launchpad specification. Only ephemeral local testing is authorized. Existing Base Sepolia creation-only contracts remain immutable, without trading. No public-network deployment or real funds were used.

## Public interfaces and arithmetic

Freshly compiled factories deploy the new `LauncherToken` with `TRADING_VERSION = 1`. Old registered tokens lack that getter; the detail page retains its creation-only state. The UI permits purchases only on chain 31337. The existing operator's embedded creation-only deployment bytecode is intentionally unchanged: public-network trading deployment remains a separately reviewed action.

`quoteBuy(uint256 budget)` returns `(tokens, gross, fee, launcherFee, platformFee, refund, supply, timestamp)`. `buy(uint256 minimumTokens, uint256 deadline)` receives the full ETH budget as transaction value, recomputes that same quote at execution, mints to the caller and refunds unused ETH atomically. Timestamp and deadline use seconds. Deadline equality is valid; execution after deadline reverts. The interface defaults to `floor(tokens × 99 / 100)` and deadline `timestamp + 300`; higher tolerance requires selecting 2% or 5%.

For supply `s` and quantity `x` in 18-decimal token units, gross buy value in wei is:

```
ceil(x * (10^12 * 10^18 + 9*10^6 * (2*s+x)) / 10^36)
```

This combines the entire integral difference into one rational numerator before rounding upward. At the bounded cap (`s+x <= 10^24`) its numerator stays below `10^55`, within uint256. Fees are `ceil(gross / 100)`, Launcher share `floor(fee/2)` and platform share the remainder. Binary search over remaining capacity finds the maximum affordable integer quantity in at most 80 iterations. A zero output or exhausted cap reverts.

Only gross value increases Curve Reserve. Fees accrue to separate role liabilities; no recipient interaction occurs while accruing fees. Refund executes after accounting and mint with OpenZeppelin ReentrancyGuard. Failed delivery reverts all changes. There is no reserve withdrawal or mint authority. Ordinary ERC-20 transfers preserve supply and reserve.

## Interface behavior

The SVG renders the mathematical marginal-price line against outstanding supply, current position, quote interval and endpoint. Pixel coordinates alone use Number; trade quantities, budgets, minimums, fee math and execution values use bigint. The exact signed minimum is displayed; formatted amounts retain their full value in a title. Quotes and market/account reads are pinned to one block, and refreshed after canonical successful purchase or on explicit refresh. A pending signature retains its original minimum, deadline and budget rather than silently accepting a newer quote.

The ticket distinguishes current/endpoint marginal prices from fee-inclusive average execution price; exposes gross, both fee shares, total charge, tokens, unused ETH, impact and timestamp/deadline; validates wallet/network, budget plus estimated gas, cap, invalid budgets and failed quotes. Receipt status, block hash and the matching Bought event are checked before labeling canonical inclusion. Finality is explicitly unverified; broader transaction replacement/reorg indexing is a later ticket.

## Narrow Scaffold UI exception

`launcher-token/AGENTS.md` ordinarily requires `@scaffold-ui/components` for `EtherInput` and `Balance`. For this ticket's ETH-budget input and quote-bound wallet balance, the accepted specification's exact 18-decimal integer values and coherent quote/accounting snapshot take precedence. This exception is limited to `LauncherBuy`; address displays still use Scaffold `Address`, and submissions still use Scaffold `useTransactor`.

The installed `@scaffold-ui/components` 0.1.12 `dist/esm/Input/EtherInput.js` always calls `useEtherInput`, exposes an ETH/USD toggle, and disables the input while native-currency pricing loads. Its installed hook (`@scaffold-ui/hooks/dist/esm/useEtherInput.js`) fetches Mainnet native-currency pricing and uses `parseFloat` for ETH/USD conversion. That introduces an unrelated remote price dependency and a floating-point conversion path into this local, exact ETH-only budget form. The replacement is a labeled native text input with decimal keyboard, explicit 18-decimal validation and `parseEther` to bigint; it performs no USD conversion.

Installed `Balance` owns its own fetching/polling through `useBalance`; its public props (`dist/types/Balance.d.ts`) accept address/chain/display options but neither an existing bigint balance nor the quote block. The ticket instead displays the bigint wallet balance read at the same pinned block as supply, reserve, holdings and quote. Submission separately checks a fresh wallet balance against the full budget plus estimated gas. Substituting independently polling `Balance` would disconnect the displayed validation balance from the quote snapshot. Revisit this exception when the library supports exact ETH-only input and externally supplied block-pinned balances.

## Verification and limits

The first cap/refund public-contract test failed compilation before the BuyQuote/quoteBuy/buy interface existed, then passed after implementation. Foundry verifies exact cap value (10 ETH reserve, 0.1 ETH fee, 0.9 ETH refund from an 11 ETH budget), one-token integral literals at zero and nonzero supply, tiny odd-wei fee allocation, maximal affordability with 256 fuzz cases, quote/execution equality, minimum and deadline rejection, ordered competing buys, exhausted-cap and zero quotes, failed refund rollback, callback reentrancy recovery, and transfers/unsolicited ETH accounting. All 17 contract tests including the prior creation suite pass. Browser-wallet evidence is recorded separately by the integration agent.

This release has no operational sell-back, fee claims, pause controls or trade indexer. Fees remain locked separate liabilities; all claimed amounts are zero. The UI discloses these limits before buying. A fresh deployment is required for later immutable trading releases; this buy-only fixture must never be presented as a funded beta or as providing an exit guarantee. No baseline business or outcome rights, guaranteed return or entry-price refund is implied.
