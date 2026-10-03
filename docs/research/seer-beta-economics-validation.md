# Accepted Seer Beta economics and failure-path validation

Evidence for [Validate the Accepted Seer Beta Economics and Failure Paths](https://github.com/MrSufferer/whatelse/issues/19), following the accepted resolution of [Design the Market Lifecycle and Economics](https://github.com/MrSufferer/whatelse/issues/7#issuecomment-5968960159). Recorded 3 October 2026.

## Result

**Mechanics pass locally; production adoption remains constrained/no-go pending the blockers below.** The accepted 10 sUSDS buy / equivalent-value sell and 5% impact policy is achievable with the external contracts. It is not established as affordable for target Launchers. In the rehearsed direct complete-set funding strategy, four equal-weight pools committed about **1,681 sUSDS**; prices `[0.70, 0.20, 0.09, 0.01]` committed about **21,841 sUSDS**. The threshold has not been relaxed.

INVALID redemption, full LP withdrawal, quote failure after withdrawal, partial funding recovery, transaction deadlines and a bonded oracle challenge were executed on localhost. An ordinary empty-sUSDS wallet acquired and sold sUSDS through the documented external PSM3 using explicitly artificial USDC funding. Cross-chain arbitration/appeals, complete dependency source provenance and the current Seer SDK/Lens execution route remain unverified. This task supplies evidence for the human go/no-go decision; it does not make that decision or authorize shipping.

## Evidence and scope

- Base fork: chain 8453, block **52108145**, public read-only upstream `https://mainnet.base.org`; Anvil bound to `127.0.0.1:18546`. State-changing transactions used only that localhost URL. No private keys, public transactions, protocol-admin impersonation, or real funds.
- Seer source and artifact snapshot: [`60423441a71dd4eead5a026a4cff93fbd4c6f4f3`](https://github.com/seer-pm/demo/tree/60423441a71dd4eead5a026a4cff93fbd4c6f4f3). Each downloaded source/artifact has a SHA-256 in `evidence/seer-beta/inspection.json`.
- `evidence/seer-beta/fork.json`: transaction inputs and receipts, snapshot-isolated price/funding cases, quotes, withdrawal checks and redemption amounts. Each case starts from the same artificially funded fork snapshot. Addresses in these cases exist only on the fork.
- `evidence/seer-beta/acquisition.json`: separate ordinary wallet, artificial USDC input, missing-allowance failure, actual acquisition and reverse conversion.
- `evidence/seer-beta/challenge.json`: failed creation and challenged-answer finality.
- `evidence/seer-beta/inspection.json`: deployed code comparisons, home-proxy getters and collateral interfaces.
- `evidence/seer-beta/arbitration.json`: read-only Ethereum proxy/fee results at its recorded block; this is a separate snapshot from the pinned Base fork.
- `scripts/seer-beta/`: dependency-free Python rehearsals, using installed `cast` for ABI encoding. Assertions compare externally observable balances, receipts, payouts and quotes. No application, SDK installation or custom contracts were created.

The main rehearsal assigns an artificial 1,000,000 sUSDS balance to a local wallet. Acquisition independently starts with zero sUSDS, but uses artificial 100 USDC and Anvil-provided ETH for gas. Neither is evidence of actual creator capital or a real-world fiat/bridge onboarding experience.

## Depth policy and funding

Every case has A/B/C plus INVALID, positive normalized Starting Prices, fee tier 3000 (0.3%) and full-range ticks `[-887220, 887220]`. Pools are discovered by the deployed V3 factory's exact outcome/collateral/fee key, initialized with sorted tokens, and checked for active liquidity. QuoterV2 exact-input calls buy with **10 sUSDS** and sell **10 / contemporaneous marginal price** Outcome Tokens. Both directions are quoted without executing either first, at the same pool state. Integer amounts round down by less than one Outcome Token wei.

Let `p` be collateral per Outcome Token from `slot0`, `f = 0.003`, buy collateral input `b`, buy output `o`, sell token input `t` and sell collateral output `s`. Fee-separated adverse average execution impact is:

- Buy: `(b × (1 − f) / o / p − 1) × 100%`.
- Sell: `(1 − s / (t × (1 − f) × p)) × 100%`.

The fee remains an explicit cost, rather than being counted as price impact twice. A 10 sUSDS buy pays 0.03 sUSDS input fee; sell fees are 0.3% of Outcome Token input. These checks use pre-trade marginal prices and actual external quotes, not post-trade spot-price movement. The baseline marginal price is a trading-depth benchmark, not a settlement oracle or calibrated probability.

| Case | Starting Prices A/B/C/INVALID | CTF backing | Direct AMM collateral | Total committed collateral | Buy impact, each pool | Sell impact, each pool | Ready |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Equal, underfunded | .25/.25/.25/.25 | 49 | 48 | 97 | 83.0833% | 45.3801% | No |
| Equal, depth funded | .25/.25/.25/.25 | 841 | 840 | 1,681 | 4.7476% | 4.5324% | Yes |
| Skew, depth funded | .70/.20/.09/.01 | 21,001 | 840 | 21,841 | 4.7476% | 4.5324% | Yes |

Units are sUSDS, not dollars. Values are rounded; raw integer transfers are in the evidence. The funded cases target 210 sUSDS per pool and mint one spare complete set to avoid integer/range-boundary shortfalls. The underfunded execution sells only the Outcome Tokens available in the wallet; its required depth **quote** still uses the full 10-sUSDS-equivalent input and fails. The funded cases execute the full-size first-outcome sell.

For an ideal full-range constant-product approximation, collateral reserve `y` gives buy impact `10 × .997 / y` and sell impact `a / (1 + a)`, where `a = 10 × .997 / y`. Thus buy requires roughly **199.4 sUSDS per pool** and sell roughly **189.43**. Direct complete-set funding with reserves `y` and Starting Prices `p_i` requires backing at least `max(y / p_i)` and direct deposits `sum(y)`. At four equal weights, the approximate limiting construction costs 1,595.2 sUSDS; with a 1% outcome, about 20,737.6. These are explanatory estimates for this funding construction, not executed boundary proofs, a globally optimized funding strategy, or exact V3 minima. The executed 210-per-pool budgets provide headroom.

The small INVALID price forces many INVALID units into its full-range pool. Minting those units requires equally many complete sets; unused higher-priced Outcome Tokens remain in the Launcher wallet. This explains the backing cost without confusing it with the collateral deposited directly into AMMs. Increasing the number of outcomes or lowering the smallest Starting Price can increase required capital. No target Launcher budget or willingness to commit this capital has been established.

## Executed protections, failures and recovery

- A malformed one-outcome creation transaction reverted and left `marketCount` unchanged. Creation is not presumed successful from a submitted transaction.
- A valid creation persisted when splitting failed for missing allowance. Approval and splitting then succeeded using the same market. Earlier successful transactions were not rolled back by later failures.
- Each initialized pool survived an expired LP-mint transaction; minting resumed successfully. LP NFTs belonged to the Launcher. Minting used **nonzero 99% amount minima and a deadline**.
- Repeating `createAndInitializePoolIfNecessary` with a different requested price did not reset an initialized pool's `slot0`. A production recovery flow must read its existing price and settings, verify the accepted Starting Prices, and refuse incompatible readiness rather than pretending it reinitialized the pool.
- First-outcome buys and sells executed through deployed SwapRouter02 and delivered the quoted outputs. Swaps used **99% minimum output** and the router's `multicall(uint256,bytes[])` deadline wrapper; the expired buy reverted. Quotes and execution consume different snapshots in a real environment, so stale quotes still require rechecking. The direct `exactInputSingle` tuple itself has no deadline field.
- Full `decreaseLiquidity` and `collect` succeeded for all four positions in all cases before finality. Withdrawal used nonzero 99% simulated amount minima and deadlines. Every pool's active liquidity became zero and the required buy quote reverted. Readiness therefore must be re-evaluated after withdrawal; the initial quote is not a continuing liquidity guarantee.
- The CTF's sUSDS balance was unchanged by AMM withdrawal. All positions were recovered, then the market finalized INVALID; payouts were `[0,0,0,1]`. Native Router redemption returned exactly the wallet's INVALID balance and zero for A/B/C. Other outcome positions have no blanket refund entitlement.
- Resolution calls reverted while unanswered and after an answer but before finality. In a separate challenge rehearsal, another ordinary wallet doubled the answer bond from 0.001 to 0.002 ETH shortly before timeout and replaced the answer with INVALID. Passing the original answer's deadline still could not resolve; the new answer's timeout had to expire. Finalization then produced `[0,0,0,1]`. This tests bonded challenges, **not arbitration or appeals**.

The fork records gas used for each successful and failed transaction, including market creation, approvals, pool setup, swaps, withdrawal and redemption. These receipts do not establish production Base L1-data fees or a current ETH budget. The 1,681/21,841 figures exclude gas, oracle answer bonds, arbitration and other external costs. The interface must estimate them at execution time and disclose them separately; beta platform fees remain zero.

## Ordinary-wallet collateral acquisition

The SDK's pinned [`psm3.ts`](https://github.com/seer-pm/demo/blob/60423441a71dd4eead5a026a4cff93fbd4c6f4f3/packages/seer-pm-sdk/src/psm3.ts) specifies Base PSM3 `0x1601843c5E9bC251A3272907010AFa41Fa18347E`, preview functions and swap execution. The tested input token is Base native USDC, 6 decimals; sUSDS has 18 decimals. The acquisition wallet initially had zero sUSDS and zero PSM USDC allowance.

At the recorded fork state, **100 USDC produced about 89.966532 sUSDS**, and reversing it returned **99.999999 USDC**. Preview and execution differed slightly as the conversion rate changed with time, so execution was checked against a nonzero 99% output minimum, not exact preview equality. PSM collateral inventory was read in the evidence. This is a demonstrated conversion path, not guaranteed future capacity or dollar parity.

The sUSDS address reverted for `asset()`, `convertToAssets(uint256)` and `previewDeposit(uint256)`; do not assume it is a Base ERC-4626 vault with a deposit path. USDC acquisition/bridging, PSM availability at real launch sizes and real-world gas funding were not established. Required balances/allowances are: ETH for gas; input USDC and allowance to PSM for conversion; sUSDS and allowance to Seer Router for complete sets; sUSDS plus Outcome Tokens and allowances to the LP manager for pools; actual input-token allowance to the execution router for trading; wrapped-token allowances to Seer Router for redemption. An approval is not an asset balance or a successful funding transaction.

## Deployment provenance, routes and arbitration

Pinned deployment artifacts match the Market template runtime exactly. MarketFactory, Router and RealityProxy match after substituting zero-valued `PUSH32` immutable words with values from the artifact constructor arguments; every other byte is identical. Patch offsets, values and runtime hashes are recorded. This is artifact-to-deployment correspondence, **not an independent compiler rebuild or audit**. The artifacts for Reality, ConditionalTokens, Wrapped1155Factory, the Base home arbitration proxy and CollateralToken do not contain runtime bytecode, so no bytecode match is claimed for them. Collateral runtime is only 170 bytes; validating its implementation/proxy chain remains required.

The Base home proxy returns Ethereum foreign proxy `0x54811e1157ccc2be68ce4cc850e5ab3382fe627f`, foreign chain ID 1 and Base messenger `0x4200000000000000000000000000000000000007`. `amb()` and `owner()` reverted: the generic AMB source from the prior report is not evidence of this deployment's bridge/ownership behavior. Read-only Ethereum getters corroborate the home-proxy pairing and expose its messenger and arbitrator. The recorded Ethereum snapshot returned **0.081 ETH** for both `arbitrationCost(extraData)` and `getDisputeFee(zeroQuestionId)`. The pinned Base Reality question fee was zero. Neither amount is an immutable fee promise; query fresh costs and account for cross-chain messaging, disputes and appeals. The generic zero-question fee read is not proof of fees or admissibility for a particular market dispute.

The current pinned SDK [`quote.ts`](https://github.com/seer-pm/demo/blob/60423441a71dd4eead5a026a4cff93fbd4c6f4f3/packages/seer-pm-sdk/src/quote.ts) and [`amm-trade.ts`](https://github.com/seer-pm/demo/blob/60423441a71dd4eead5a026a4cff93fbd4c6f4f3/packages/seer-pm-sdk/src/amm-trade.ts) use **Lens smart quoting and its selected DEX execution target**, rather than promising SwapRouter02. It checks Lens deployment and handles no-route failures. This rehearsal validates exact direct V3 pools/QuoterV2/SwapRouter02, not SDK or Lens pool selection, approval targets, alternate fee tiers, multi-hop routing or execution payload compatibility. A successful direct quote must not be described as a successful current SDK route. The accepted beta fee tier must be enforced even if a route chooser finds a different pool.

## Remaining blockers for the map

1. **Affordability and the funding promise:** willingness and ability of target Launchers to commit the observed budgets, especially low-INVALID-price configurations, remain unknown. Arbitrarily small positive Starting Prices have no established practical budget bound. Keep the accepted threshold; either validate an affordable envelope or obtain a new human policy decision.
2. **Contested arbitration/bridge and provenance:** exact implementations of all dependencies, authenticated cross-chain messages, request/acknowledgment/ruling/failure/appeal paths and changing costs have not been end-to-end validated. A bonded challenge and fee reads do not clear this blocker. An independent source rebuild, implementation resolution and an isolated paired-chain rehearsal are still needed.
3. **Chosen route and recovery integration:** execute the current SDK/Lens route on a fork with the accepted pools, validate fee/range/token selection, deadline/slippage/approval targets and no-route handling, and rehearse incompatible populated existing pools/alternate settings. Direct reinitialization behavior is established, but this does not validate the product's pool-discovery/recovery implementation.
4. **Real collateral onboarding/capacity:** an ordinary-wallet PSM conversion was demonstrated from artificial USDC. Real USDC acquisition, ETH funding, and PSM liquidity/limits at 1,681–21,841 sUSDS launch sizes remain unestablished.

These are explicit integration-readiness gaps, not implicit passes. They are sufficient to inform a constrained/no-go result while the map's final human decision remains open. No production implementation is scaffolded as a consequence of this task.

## Reproduction

Prerequisites: Python 3, installed Foundry `anvil`/`cast`, and public read access to the pinned Base state and GitHub. In a terminal:

```bash
anvil --fork-url https://mainnet.base.org --fork-block-number 52108145 \
  --fork-header 'User-Agent: seer-local-validation' --port 18546 --host 127.0.0.1
```

On that **fresh** fork, run sequentially from the repository root:

```bash
python3 -m py_compile scripts/seer-beta/*.py
python3 scripts/seer-beta/rehearse.py
python3 scripts/seer-beta/acquire.py
python3 scripts/seer-beta/challenge.py
python3 scripts/seer-beta/read_deployments.py
python3 scripts/seer-beta/read_arbitration.py
```

The first script requires the exact fresh block and rejects a non-Anvil RPC. All transaction helpers have a hardcoded localhost endpoint; the public Ethereum inspector contains only chain/block/`eth_call` reads. Run the acquisition and challenge scripts sequentially to avoid time changes during conversion. Replaying on a used fork requires restarting it; the main rehearsal refuses to treat a partial prior run as fresh. Auxiliary local scripts verify Anvil and chain ID but operate on the state left by the preceding steps. The Ethereum inspection uses a new pinned block on each run, so current fees may differ. RPC availability can fail; failures must remain explicit evidence, not fabricated success.
