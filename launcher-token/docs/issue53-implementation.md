# Reviewed proposals and beta admission

Implemented [Review a Launcher proposal and invite a Participant](https://github.com/MrSufferer/whatelse/issues/53), reviewed against `11e1faf`.

The Launcher submits an immutable business identity, HTTPS community links, description, benefits, name/symbol, both fixed recipients and the creation-only initial-purchase choice. Each revision has a new proposal ID and disclosure hash. The operator reviews those exact terms with a reason and source, signs the existing factory review or Launcher-admission action, then records its canonical receipt. Participant invitations and revocations are authenticated operator actions stored in PostgreSQL. Public token detail retains the exact reviewed business disclosures after creation and admission revocation.

The existing factory remains the authority for creation: Launcher admission, exact approved terms and revision, and an unused approval are required. Approval consumption, rejection and revocation are checked through its public creation interface. A new revision is independently reviewed; operators must revoke an older approval when retiring it. Interface admission does not change token ownership, transfer permissions or direct contract access. This remains a zero-supply test fixture without trading or initial purchases.

## Runtime and rollout

The beta HTTP API runs in the Next.js Node server under `/api/beta/*`. Configure server-only `APP_ORIGIN`, `DATABASE_URL` and `BETA_RPC_URL`, plus the existing public chain/factory configuration. Run from `launcher-token`:

```sh
yarn install --immutable
yarn workspace @se-2/nextjs db:migrate
yarn workspace @se-2/nextjs build
yarn workspace @se-2/nextjs next start
```

The additive migration is idempotent. Use the private PostgreSQL connection with provider TLS requirements; never prefix credentials with `NEXT_PUBLIC_`. The reserved frontend currently lacks `DATABASE_URL`: deployment must explicitly supply it privately to the Next server, reconcile the monorepo root/build/start configuration, and run the migration. The separately reserved worker remains available for later discovery ingestion. This workflow requires a Node server and is not a static/IPFS deployment.

Authentication uses short-lived, single-use, origin/network-bound SIWE challenges and opaque, hashed database sessions in HttpOnly cookies. Writes require the configured origin; operator authority is checked against the current factory owner. Unauthorized actions fail closed. Chain-backed confirmations check sender, exact calldata, successful canonical receipt, current contract state and the latest relevant event. Unique transaction hashes make recording retries idempotent; canonical block/transaction positions determine current state even if HTTP confirmations arrive out of order. The operator screen retains a pending confirmation locally to recover after reload without sending the transaction twice.

PostgreSQL stores proposals, append-only decisions, provenance, admission and authentication state. The existing full-database backup policy covers these tables once deployed. Hosted deployment, hosted application recovery and Base Sepolia wallet execution were not performed by this implementation.

## Verification

All verification used a dedicated local PostgreSQL database and local Anvil chain 31337 with fictional businesses and unlocked test accounts.

- HTTP integration suite: 5 passed. Covers origin/chain/signature binding, challenge replay and concurrent consumption, unauthorized actions, invitation/revocation, idempotent and superseded receipt recording, immutable revisions and history, rejected/revoked/tampered creation, approval consumption, public disclosures and direct ERC20 calls outside interface admission.
- Existing Foundry suite: 7 passed, including fuzz verification. No contract changes.
- Production build, lint and TypeScript checks passed.
- Browser walkthrough passed proposal submission, operator review, Launcher approval, Participant invitation, cancelled creation/retry, creation and exact public disclosures, session deletion with cached data, Participant revocation, and continued public token detail. Widths 375, 768 and 1280 had no overflow.
- A production-server restart preserved the browser-created proposal ID, disclosure revision, reviewer/time and token association. This verifies application persistence locally, not hosted disaster recovery.

Repeat HTTP tests with the local fixture/server running using `yarn workspace @se-2/nextjs test:beta`. Browser automation is [browser-beta-checks.js](../scripts/browser-beta-checks.js), run through Playwright CLI after installing [browser-wallet.js](../scripts/browser-wallet.js). Screenshots are in [issue53 evidence](../evidence/issue53).

## Standards review

Final material findings: 0. Earlier import consistency and duplicated receipt-verification findings were fixed and rechecked.

## Spec review

Final material findings: 0. Public exact business disclosures and rejection of superseded chain actions were added and rechecked against the acceptance criteria.

## Requested Grumpy Carlos review

Final material findings: 0 through `7c0613d`. Session-cache failure handling, operator confirmation recovery and canonical ordering were addressed. Independent security and operational readiness remain separate map conditions.
