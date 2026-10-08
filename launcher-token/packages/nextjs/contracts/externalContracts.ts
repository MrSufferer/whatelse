import { tokenFactoryAbi } from "~~/utils/launcher/abis";
import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

// No deployment is implied by a missing address. The UI separately gates unconfigured writes.
const address = (process.env.NEXT_PUBLIC_TOKEN_FACTORY ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const externalContracts = {
  84532: { TokenFactory: { address, abi: tokenFactoryAbi, deployedOnBlock: 0 } },
  31337: { TokenFactory: { address, abi: tokenFactoryAbi, deployedOnBlock: 0 } },
} as const;
export default externalContracts satisfies GenericContractsDeclaration;
