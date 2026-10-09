import { type Address, type Hex, createPublicClient, http } from "viem";
import { fail } from "~~/services/beta/errors";
import { tokenFactoryAbi } from "~~/utils/launcher/abis";
import { factoryAddress, network } from "~~/utils/launcher/config";

type Confirmation = { hash: Hex; actor: Address; data: Hex } & (
  | { kind: "review"; proposal: Hex }
  | { kind: "admission"; launcher: Address }
);
// Confirm the latest relevant canonical event, not merely an equal current boolean.
// Scanning starts at the supplied receipt, so stale confirmations fail closed.
export async function verifyReceipt(input: Confirmation) {
  if (!factoryAddress) return fail(503, "Factory is unconfigured");
  const rpc = createPublicClient({ chain: network, transport: http(process.env.BETA_RPC_URL) });
  const [tx, receipt] = await Promise.all([
    rpc.getTransaction({ hash: input.hash }),
    rpc.getTransactionReceipt({ hash: input.hash }),
  ]);
  const block = await rpc.getBlock({ blockNumber: receipt.blockNumber });
  if (
    receipt.status !== "success" ||
    receipt.blockHash !== block.hash ||
    tx.to?.toLowerCase() !== factoryAddress.toLowerCase() ||
    tx.from.toLowerCase() !== input.actor.toLowerCase() ||
    tx.input !== input.data ||
    tx.value !== 0n
  )
    fail(409, "Receipt does not match this operator action");
  const logs =
    input.kind === "review"
      ? await rpc.getContractEvents({
          address: factoryAddress,
          abi: tokenFactoryAbi,
          eventName: "ProposalReview",
          args: { proposal: input.proposal },
          fromBlock: receipt.blockNumber,
          toBlock: "latest",
        })
      : await rpc.getContractEvents({
          address: factoryAddress,
          abi: tokenFactoryAbi,
          eventName: "LauncherApproval",
          args: { launcher: input.launcher },
          fromBlock: receipt.blockNumber,
          toBlock: "latest",
        });
  const ordered = logs.sort((a, b) =>
    a.blockNumber === b.blockNumber
      ? Number(a.logIndex) - Number(b.logIndex)
      : a.blockNumber! < b.blockNumber!
        ? -1
        : 1,
  );
  if (ordered.at(-1)?.transactionHash !== input.hash)
    fail(409, "Action was superseded onchain; refresh before retrying");
  return { ...receipt, onchainAt: new Date(Number(block.timestamp) * 1000) };
}
