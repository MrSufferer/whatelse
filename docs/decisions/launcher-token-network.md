# Launcher Token deployment network

The user confirmed Base Sepolia for testing and Base Mainnet as the eventual release target on 2026-10-05, while resolving [Confirm the Launcher Token deployment network](https://github.com/MrSufferer/whatelse/issues/26). This preserves the accepted Base planning context and tests the application on the same network family before release. It does not authorize deployment or real funds; the Controlled Beta's security, legal, operational and release gates still apply.

| Purpose | Network | Chain ID | Public read-only RPC | Explorer |
| --- | --- | --- | --- | --- |
| Testing | Base Sepolia | 84532 (`0x14a34`) | `https://sepolia.base.org` | `https://sepolia.basescan.org` |
| Eventual release | Base Mainnet | 8453 (`0x2105`) | `https://mainnet.base.org` | `https://basescan.org` |

These are the [official network parameters](https://docs.base.org/get-started/connect-to-base). The public RPCs are rate limited and unsuitable as production infrastructure. Selecting and verifying an operational RPC provider remains a separate prerequisite. Reject a provider whose `eth_chainId` differs from the configured network; never silently switch networks.

## Transaction finality policy

Base's [transaction finality documentation](https://docs.base.org/specifications/transactions/transaction-finality) distinguishes Flashblock preconfirmation (approximately 200 ms), L2 block inclusion (approximately 2 seconds), L1 batch inclusion (approximately 2 minutes), and L1 batch finality (approximately 20 minutes). These are estimates, not completion timers. The approximately seven-day withdrawal challenge period is separate from transaction finality and does not gate ordinary Launcher Token trades.

Use the network's `latest`, `safe` and `finalized` block tags, whose meanings are specified in [Base derivation](https://docs.base.org/specifications/base-protocol/consensus/derivation). Apply the same state policy on both selected networks; do not promise Mainnet timing estimates on Sepolia.

- A wallet signature is signing; a broadcast transaction is submitted. A preconfirmation alone cannot establish inclusion or success.
- A receipt in a canonical L2 block establishes inclusion. Check its status: a reverted receipt is failed, never a completed trade. Successful inclusion may refresh quotes, holdings and statistics from canonical, block-pinned reads, with provisional activity visibly identified.
- A canonical block covered by the `safe` head is safe, but remains distinct from finalized completion.
- Mark a successful transaction finalized only when its receipt block belongs to the canonical ancestry of the provider's `finalized` head. Check the receipt block hash against canonical block data and maintain ancestry during indexing; block height alone is insufficient. Read the finalized head and validate it against the same canonical chain view before promotion.
- If a receipt's inclusion becomes orphaned, retract its activity and derived effects and resume pending/recovery handling. Rejected signatures, replacements, dropped transactions and reverts retain their own states; they never produce synthetic completed trades.
- Missing or unsupported finality tags, inconsistent ancestry, RPC failure or stale finality data leave finalization unverified and expose syncing/unavailable status. Never substitute a fixed confirmation count or elapsed-time timeout. A contradiction involving previously finalized history stops affected processing for incident investigation.

The ingestion worker must retain block hashes, parent hashes and replayable events; update progress atomically; roll back to the common ancestor when provisional history changes; and reconcile holdings/accounting with contract reads at the same canonical block. Freshness and finality are separate: the latest provisional state can be fresh while still awaiting finalization.

## Deployment provenance

No Launcher Token factory or token deployment address or deployment block is assigned by this decision. Later deployment work must record the actual network, transaction, address, block number and block hash for each deployment, verify the receipt and bytecode, and start ingestion from that recorded provenance. Historical Seer addresses and deployment blocks are unrelated and must never seed the Launcher Token registry or cursor.

## Read-only verification

Live chain ID, block-tag and explorer observations are recorded in [network-verification.json](../../evidence/launcher-token/network-verification.json), captured at 2026-10-05T10:14:42Z using read-only `eth_chainId` and `eth_getBlockByNumber` calls, followed by HTTP reads of the finalized block's explorer page. Both networks returned the expected chain ID and all three block tags. Both explorer pages contained the RPC's finalized block hash:

| Network | Finalized block | RPC hash matched by explorer |
| --- | --- | --- |
| Base Mainnet | [52202487](https://basescan.org/block/52202487) | `0xf05836ea59488a8149b1c877547cc66df0213740348c9c77b75775c77eee9122` |
| Base Sepolia | [47712882](https://sepolia.basescan.org/block/47712882) | `0xd56ec617d6030b8d4b935b28f02aac05a86afd1367e210740182a72a2deb75aa` |

The initial Python HTTP transport returned 403; the successful capture used curl. These observations establish endpoint behavior at the observation time, not production provider availability, application transaction correctness or a Launcher Token deployment. The block numbers above are verification samples, never deployment cursors.
