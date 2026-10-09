### Overall Assessment

Good stuff: the new sell path is small, uses exact integer arithmetic, and keeps reserve and fees separate. I found no new asset-safety blocker in this diff. The trade UI carries some buy-only naming into the new sell behavior; clean that up before it spreads. Scope reviewed: `170ed66...HEAD`, including runtime changes, contract tests, and local evidence harnesses.

### Critical Issues

None - good stuff!

### Improvements Needed

- **Optional clarity improvement:** `launcher-token/packages/nextjs/components/LauncherBuy.tsx:184,186,246` now uses `buy()`, `signed.budget`, and `bought` for both directions. Before: `buy()`, `budgetWei`, `bought`. After: `submitTrade()`, `inputBaseUnits`, `verifiedTrade`. The component also merits `LauncherTrade` when its imports are updated together. These names were accurate in the predecessor; extending them to sells now obscures whether a value represents ETH or token units when reviewing signing and receipt validation. No behavior change is required.
- **Documentation correction:** `docs/implementation/issue-35-token-sell.md:7` claims the surface uses “SE2’s transactor/write hooks,” but `LauncherBuy.tsx:232–236` uses `useTransactor` around raw `wallet.writeContract`. Say exactly that, and document the narrow dynamic-address hook exception. The existing Scaffold hook resolves a named static deployment; this surface trades arbitrary factory-created addresses. The predecessor already used this architecture, so a hook-system rewrite is not warranted for this ticket. This is a documentation/convention issue, not an asset-safety blocker.

### What Works Well

`TokenFactory.sol` follows checks/effects/interactions, rejects expired/minimum-invalid trades, burns before delivery, and shares the reentrancy guard across buys/sells. The new tests include failed delivery rollback, cross-path reentrancy, fractional rounding and funded unwind. I ran `forge test --match-contract TokenSellTest -q`; it passed. Browser evidence includes independent rational accounting and actual reverted receipts; I inspected it without rerunning the browser harness.

The approved graphite/mint/pink direction overrides upstream semantic-color preferences. The documented exact-input/block-pinned-balance exception overrides upstream EtherInput/Balance preferences. Addresses still use Scaffold Address.

### Refactored Version

No significant rewrite needed; apply the targeted naming/documentation changes above.
