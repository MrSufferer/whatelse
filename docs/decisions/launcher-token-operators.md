# Launcher Token test operators and admission

Prerequisite resolution for [Confirm operator identities and beta admission](https://github.com/MrSufferer/whatelse/issues/29), under [Find the Route to a Verified Launcher Token Controlled Beta](https://github.com/MrSufferer/whatelse/issues/25).

## Confirmed identities

The user approved the following single-wallet test setup in the implementation conversation. The network is Base Sepolia, chain ID 84532. These assignments apply to testing only; release identities remain unassigned.

| Role | Public address |
| --- | --- |
| Deployer | `0xeD37FD0d6F0f69236E7472B36796e133D20EcC32` |
| Authorized creation and buy-control operator | Same address |
| Platform fee recipient | Same address |
| Test Launcher and Launcher fee recipient | Same address |
| Invited test Participant | Same address |

The user identified MetaMask as their wallet and confirmed manual signing with faucet test ETH only. Shared identities simplify this initial fixture; they do not demonstrate isolation between roles. Later behavioral verification must exercise distinct actors and fee accounting, including when recipients coincide. Each Launch records both fixed recipient roles explicitly.

## Wallet control

The user signed the exact readable challenge in [operator-wallet-verification.json](../../evidence/launcher-token/operator-wallet-verification.json). Offline EIP-191 recovery with ethers `verifyMessage` returned the expected address. The artifact preserves the exact UTF-8 message, signature, digest, verifier version and verification timestamp. No private key or seed phrase was requested or received.

This proves control of the signing key for this challenge, not ongoing access, application authentication or deployed contract authority. The challenge is consumed for this prerequisite and must never be accepted as a reusable login. Actual deployed permissions must be checked against contract reads when deployments exist. Verification follows the [ethers hashing documentation](https://docs.ethers.org/v6/api/hashing).

## Signing and funding procedure

The user signs deployment transactions manually in MetaMask. Later deployment work must present the exact Base Sepolia transaction, requested permissions and gas/value for review, verify the selected account and chain, and record deployment receipts and provenance. Do not export a private key or substitute unattended agent signing.

Authorized test funding is faucet test ETH only. No funded transaction or deployment was performed in this prerequisite. No Mainnet funding, transfer from another funded wallet or real-funds release is authorized. If faucet funding is unavailable or insufficient, return to the user for a new funding choice.

## Reviewed fictional fixture

The user approved a fictional test business/proposal with no additional token benefits. Instantiate that approval as the following fixture, visibly marked fictional wherever displayed:

| Field | Fixture |
| --- | --- |
| Proposal identifier | `fictional-test-launcher-v1` |
| Business | Fictional Test Prediction Business |
| Token name / symbol | Fictional Test Launcher / FTEST |
| Launcher and fixed recipients | The confirmed test address above |
| Description | Fictional prediction-market business used solely to exercise Launcher Token beta workflows. |
| Community links | None; no real business or customer affiliation asserted |
| Additional benefits | None |
| Initial purchase | None authorized by this prerequisite; start at zero supply |
| Review status | Approved as a fictional Base Sepolia fixture by the user in this conversation |
| Participant invitation | Confirmed test address invited for interface testing |

The accepted fixed economics and absence of baseline business or outcome-payout rights remain unchanged. This record supplies implementation inputs; it is not a deployed proposal approval, token or operating business.

## Admission and provenance

The user approved wallet-authenticated interface allowlists, proposal approval/revocation and attributable provenance. The later admission workflow must authenticate the connected address with a fresh, expiring, single-use challenge bound to the application origin and network before granting interface access or accepting operator actions. Merely connecting a wallet or supplying an address is insufficient.

Maintain separate Launcher approval, Participant invitation and proposal-review records. Bind a reviewed proposal to its Launcher, name/symbol, business disclosures, both fixed fee recipients and revision. Record actor, action, timestamp, reason and the reviewed revision for approval, revocation and subsequent changes; material changes require renewed review. Preserve historical provenance rather than erasing revoked records. Creation must enforce the approved proposal through authorized creation controls.

Admission controls interface access. Revocation and incident controls may restrict creation and new buys, but must preserve ERC-20 ownership, transfers and direct contract sells. Keep holdings and exit access available when discovery eligibility changes. Admission is not platform endorsement. These are confirmed requirements for the subsequent implementation, not claims of functioning authentication or onchain enforcement today.
