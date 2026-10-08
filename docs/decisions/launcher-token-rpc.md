# Launcher Token RPC access

Resolution of [Provide and verify the RPC connection](https://github.com/MrSufferer/whatelse/issues/27), following the [network decision](launcher-token-network.md).

## Credentials and access

Owner: repository operator Kyler / MrSufferer. The operator supplied `BASE_RPC_URL` in the local repository `.env`; it is an Infura **Base Sepolia** endpoint. `.env` is gitignored. Authorized agents read this local environment without printing, copying into issues, or committing the value. For hosted testing workers, the operator transfers `BASE_RPC_URL` through the hosting provider's private service environment; that transfer is not performed by this task. Rotate/revoke the credential in the owner's Infura dashboard and replace the private environment value when needed. Never put it in browser bundles, `NEXT_PUBLIC_*`, logs, URLs returned by the API, screenshots or telemetry. No credential value or endpoint identifier is recorded in the evidence.

## Worker and browser paths

| Consumer | Testing: Base Sepolia (84532) | Eventual release: Base Mainnet (8453) |
| --- | --- | --- |
| Server ingestion/read worker | Private `BASE_RPC_URL`; reject any chain ID other than 84532 | A separate private `BASE_MAINNET_RPC_URL`, to be provisioned and verified before production; never reuse the test endpoint |
| Browser public reads | Public `https://sepolia.base.org` for development reads; durable discovery/activity/holdings via the application read API | Public `https://mainnet.base.org` only for verification/development; production reads via the application API |
| Connected wallet | Wallet's injected provider on chain 84532; validate chain before use | Wallet's provider on chain 8453 after release authorization |

These are access contracts for later application implementation; no application worker or browser transport is deployed here. Wallet operations use the wallet provider, not the server secret. A future API must expose bounded application queries rather than an unrestricted RPC proxy. Browser-visible chain IDs, explorer links and official public RPC URLs contain no secret. This task uses no wallet and sends no transactions.

## Verification and availability

Run `python3 scripts/launcher-rpc/verify.py` from the repository. Requires Python 3 and curl with outbound HTTPS. It loads `.env` (an exported `BASE_RPC_URL` overrides it), requires the private connection to identify as Base Sepolia, and separately checks the official public Mainnet endpoint. On failure it removes prior successful evidence and exits nonzero with private diagnostics suppressed. Endpoint URLs are passed to curl through stdin rather than command arguments.

[Captured evidence](../../evidence/launcher-token/rpc-verification.json) records successful reads on both networks at its `checked_at` timestamp:

- `eth_chainId`, and `latest`, `safe`, `finalized` blocks including hashes and parent hashes.
- Nonempty WETH9 bytecode and `decimals()` returning 18, pinned to the finalized block number.
- `eth_getLogs` filtered to WETH9 over ten blocks ending at that finalized block; both endpoints returned matching logs in the final capture. Empty arrays are also valid for a bounded filter.
- A second read of the pinned block confirming the hash remained stable during the probe.

WETH9 is only a known read probe, never a Launcher Token address or ingestion cursor. Tag ordering is a sanity check, not proof of canonical ancestry or transaction finality. Preserve the network decision's ancestry/reorg policy when implementing ingestion.

Availability is a point-in-time success only. No uptime guarantee, throughput benchmark, archive-depth guarantee, WebSocket test, failover test or account-plan quota is established. The Infura account's subscribed capacity is owner-managed and not available from these JSON-RPC reads. Public endpoints are rate limited and unsuitable for production. Mainnet production provisioning remains in the map's existing out-of-scope production deployment work; it is not represented as ready here.

## Limits and handling for implementation

The probe deliberately sends sequential requests, a 25-second transport timeout, and one ten-block address-filtered log request per network. These are local probe bounds, not measured provider maxima. Workers should start with bounded address/topic-filtered windows, split failed oversized ranges, back off with jitter on throttling, and preserve their cursor on failure. Exhausted quota or unavailable RPC must expose syncing/unavailable state; do not substitute fabricated activity or switch networks.

Infura documents `eth_getLogs` constraints of 10,000 results and 10-second query duration (plus 5,000 request parameters); treat these as documented general constraints, not a tested Base account entitlement. Its throughput and daily credit quotas depend on the account plan. Before sustained ingestion, the owner checks the project's dashboard and configures budgets/alerts; before production, provision dedicated capacity on each required network. No deliberate quota-exhaustion or maximum-range test was performed.

## Sources

Current official docs consulted 2026-10-08, including Context7 lookup for Base:

- [Base network parameters and public endpoint limits](https://docs.base.org/base-chain/quickstart/connecting-to-base).
- [Base WETH9 predeploys on Mainnet and Sepolia](https://docs.base.org/specifications/reference/base-contracts).
- [Infura log query constraints](https://docs.infura.io/reference/ethereum/json-rpc-methods/eth_getlogs/).
- [Infura credit costs and throughput errors](https://docs.infura.io/get-started/pricing/credit-cost/).
