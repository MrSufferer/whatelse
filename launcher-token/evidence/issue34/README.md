# Issue 34 local browser evidence

Observed on ephemeral Anvil chain 31337 with a fresh factory at `0x5fbdb2315678afecb367f032d93f642f64180aa3` and registered token `0xa16E02E87b7454126E5E10d957A927A7F5B5d2be`. The Next.js app ran at localhost:3001. No public-network transaction or real funds were used.

`quote-oracle.json` compares six zero-supply contract quotes with independently generated Python integral results, including tiny odd fee wei and a cap-reaching budget. All amounts are exact strings. `browser-results.json` records guards, actual reverted minimum/deadline transactions, and the cap-reaching keyboard purchase. `cap-accounting.json` independently recomputes the successful Bought event integral, rounded fee shares and refund from the previous block's supply, and verifies contract ETH equals reserve plus both fee liabilities. Separate buys accumulate upward rounding: final reserve is 10 ETH + 1 wei, contract ETH is 10.1 ETH + 2 wei.

The minimum race executes a real 1 ETH competing buy between simulation and wallet send. The deadline race advances local chain time by 301 seconds at the same boundary. Both buyer receipts have status zero and leave supply and contract ETH unchanged from the intervening baseline. Reverted transactions still spend gas. The successful 11 ETH budget purchase reaches the cap and refunds 1.909999999999999997 ETH; wallet delta equals actual charge plus receipt gas. Further buys are disabled.

The guard run covers unaffordable 1 wei / quote failure, insufficient balance, wrong chain without signing, disconnected-wallet blocking, explicit higher tolerance and user cancellation retaining the input. Screenshots at 375, 768 and 1280 pixels have no horizontal overflow and were visually inspected. Expected cancelled/reverted transaction logging produces browser console errors; these runs do not claim an error-free console.

## Harness replay

The harness scripts are Playwright CLI `run-code --filename` snippets used with the existing `launcher-token/scripts/browser-wallet.js` injected local wallet. They require a fresh Anvil fixture with the addresses above, the detail page open and its wallet connected. Run guards, race-actions, race-bridge, test-races, then cap in order. The cap script sends a real local transaction. RPC mutation is isolated to localhost:8545, and the wallet restricts sends to chain 31337. Run quote comparison before purchases. The recorded JSON and hashes are evidence of this run, not reusable deployed addresses.

## Final review

Two separate agents reviewed the diff from `11e1faf`: Standards including the original Grumpy Carlos reviewer, and Spec against issue 34 and parent spec 24. Spec reported zero findings. Standards reported one required-library-control conflict, resolved in `d052a7a` with a narrow documented source-verified exception for exact ETH-only input and block-pinned balances. Follow-up review confirmed zero unresolved findings. No runtime change was needed for that resolution.
