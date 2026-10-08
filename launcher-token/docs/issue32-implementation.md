# Reviewed creation: issue 32

Scope: approved proposal → wallet → real registered zero-supply ERC-20 → chain/address detail. Implements Explore/Create/Detail and a separate manually signed `/operator` deployment preparation page. The selected editorial graphite/mint design uses top navigation, responsive spread, fixed disclosures and tabular empty activity.

This is a **creation-only fictional test fixture**, permanently zero supply. No mint authority, upgrade, initial purchase, buy, sell or fee claims exist. Token ETH delivery is rejected. The fixed preset is recorded for review; it does not implement a market maker. Later trading tickets require a new reviewed deployment. No tokens or participant funds are stranded in this fixture.

## Contract boundary

`TokenFactory` uses OpenZeppelin Ownable. Operator reviews bind proposal identifier to exact Launcher/name/symbol/disclosure revision/Launcher recipient/platform recipient. Launcher approval and proposal review are separate. Review and revocation emit attributable actor/time/reason/revision events; previous logs preserve history. Creation rejects missing/revoked/consumed reviews, wrong Launchers and metadata/revision tampering. Creation registers token and emits recipients/preset/chain identity. Recipients and token preset have no setters.

Participant admission (#53) is explicitly unavailable. Wallet connection is not interface authentication. No historical wallet proof is reused as login; no fake authentication is introduced.

## Confirmation

Create opens detail only from a successful canonical receipt with a matching factory creation event and chain/Launcher/proposal. Detail checks receipt/token/chain identity again. Inclusion is provisional. Finality is claimed only after hash ancestry from the provider finalized head matches the receipt block, with a canonical-number recheck. RPC failures/inconsistency/distant ancestry leave finality unverified. The 256-block limit bounds RPC work, not a confirmation threshold. Receipt state resets when token/hash changes. No timer completes a Launch.

## Verification (2026-10-08)

Agreed seams: factory/token public interfaces and browser wallet-to-detail boundary. First tracer: `forge test --match-contract ReviewedLaunchTest` failed because `TokenFactory.sol` did not exist; the minimal approval/zero-supply creation implementation then passed. Subsequent failure-path coverage exercises public interfaces. Browser cancellation exposed horizontal overflow and verbose SDK errors; responsive min-width/error wrapping and parsed error messages fixed it, with overflow false on the rerun.

- `forge test --root packages/foundry --offline --fuzz-runs 1000`: seven tests pass, including unauthorized accounts, missing/revoked approvals, wrong revision/metadata, repeat creation, no free mint, rejected ETH and preset literals. Foundry tests require execution outside this macOS sandbox because its system proxy probe panics inside the sandbox.
- `yarn next:check-types`: passes.
- `yarn next:lint`: no errors (the final warning cleanup removes deprecated FormEvent and operator unused destructuring).
- `NEXT_TELEMETRY_DISABLED=1 yarn workspace @se-2/nextjs next build --webpack`: passes. Existing connector dependencies emit dynamic-import warnings from `ox/tempo`; no application build errors.
- Real Chromium + injected EIP-6963/EIP-1193 wallet backed by local Anvil: connection, explicit wrong-chain blocking, cancellation preserves form and stays on Create, genuine reverted receipt after an onchain approval-revocation race, then reapproval and keyboard Tab/Enter creation. Success navigates to a real detail route at chain 31337/address; zero supply and no synthetic trades are shown. Mobile 390px Create/Detail have no horizontal overflow after correction. Detail reload reads registry data with receipt identity reset; 375px, 768px and 1280px also have no overflow. Final reload has zero browser errors. Durable results and mobile capture are under `evidence/issue32/`. `scripts/browser-creation-checks.js` retains boundary assertions for a fresh approved fixture.
- `scripts/browser-wallet.js` installs only a loopback Anvil bridge. `scripts/browser-revocation-race.js` injects an actual operator revocation before forwarding the creation transaction with a gas limit; this yields a real reverted receipt, not a fabricated RPC failure. These test harnesses use ephemeral unlocked accounts, never an owner private key or live chain.

Actual local provenance is in `evidence/issue32/local-anvil.json`: factory `0x5fbdb2315678afecb367f032d93f642f64180aa3`, deployment block 1; approved creation token `0xa16E02E87b7454126E5E10d957A927A7F5B5d2be`, block 7, transaction `0xc277d4afd466e66359678fbc9c6d3e813b48e56bd1ff7c3bc010bc96250e0870`. This is ephemeral **Anvil evidence, not Base Sepolia deployment or MetaMask evidence**.

## Run and manual owner handoff

From `launcher-token`, install with `yarn install`, run `anvil`, `forge build --root packages/foundry`, then `node scripts/local-fixture.cjs`. This local-only script checks chain 31337, deploys/reviews through unlocked test accounts and writes ignored frontend `.env.local`. Run `NEXT_TELEMETRY_DISABLED=1 yarn workspace @se-2/nextjs next dev --webpack`.

For Base Sepolia, remove local `.env.local` and configure `NEXT_PUBLIC_TOKEN_FACTORY` only after a real deployment. Default chain is 84532 and burner wallets are disabled. No private RPC secret is read or exposed. `/operator` prepares exact constructor/approval/review transaction data with account/chain/value/gas/fee review, verifies current account and live contract authority, then requires the approved owner to sign in MetaMask. Receipts are displayed and linked for recording; successful inclusion is explicitly provisional. Faucet test ETH only. No private key export or unattended live deployment is permitted. Regenerate deployment bytecode after any contract edit with `node scripts/generate-operator-bytecode.mjs` after `forge build`.

Base Sepolia addresses/blocks remain **unconfigured** until owner manual signing in the subsequent walkthrough (#33). No real funds, live transaction or release are represented by this local verification.

Review record: the original Grumpy Carlos reviewer reviewed `b9cd8aa` with no material blockers; optional suggestions were typed dynamic reads, extracting receipt/finality handling, and automated bytecode synchronization. Generated operator bytecode was independently verified to match the compiled factory. Standards review reported zero material findings. Receipt-recording and preparation-time authority-check wording were corrected. Final Spec review is coordinated by the integration owner after the added unauthorized/revoked mobile evidence; that evidence explicitly records the already-consumed proposal overlap.

Independent run2 closes the overlapping consumed-state limitation: a fresh Anvil deployment had zero registered tokens, approved wallet enabled, unauthorized account disabled, and restored approved wallet enabled. A real pre-creation revocation at block 4 then disabled creation; mobile 375px Tab/Enter produced zero wallet send requests and stayed on Create without overflow. Separate `local-anvil-run2.json` and `run2-*-mobile.png` preserve provenance and screenshots without overwriting run1.
