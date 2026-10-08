// Local Anvil only. No private keys; unlocked ephemeral accounts. Never points at a remote RPC.
const fs = require('node:fs');
const { createRequire } = require('node:module');
const requireNext = createRequire(require('node:path').resolve('packages/nextjs/package.json'));
const { createPublicClient, createWalletClient, http, keccak256, stringToHex } = requireNext('viem');
const { foundry } = requireNext('viem/chains');
(async () => {
 const publicClient = createPublicClient({ chain: foundry, transport: http('http://127.0.0.1:8545') });
 if(await publicClient.getChainId()!==31337)throw new Error('Local chain required');
 const wallet=createWalletClient({chain:foundry,transport:http('http://127.0.0.1:8545')});
 const [account]=await wallet.getAddresses();
 const artifact=JSON.parse(fs.readFileSync('packages/foundry/out/TokenFactory.sol/TokenFactory.json'));
 const hash=await wallet.deployContract({account,abi:artifact.abi,bytecode:artifact.bytecode.object,args:[account,account]});
 const deployment=await publicClient.waitForTransactionReceipt({hash}); const address=deployment.contractAddress;
 const id=keccak256(stringToHex('fictional-test-launcher-v1')); const revision=keccak256(stringToHex('fictional-test-launcher-disclosures-v1'));
 const approvals=[];
 for(const [functionName,args] of [['setLauncherApproval',[account,true,'Local fictional fixture']],['reviewProposal',[id,account,'Fictional Test Launcher','FTEST',revision,account,true,'Local reviewed fictional fixture']]]) {
 const hash=await wallet.writeContract({account,address,abi:artifact.abi,functionName,args}); const receipt=await publicClient.waitForTransactionReceipt({hash}); approvals.push({functionName,hash,block:receipt.blockNumber.toString(),blockHash:receipt.blockHash,status:receipt.status});
 }
 const evidence={network:'Anvil (ephemeral test only)',chainId:31337,account,factory:address,deployment:{hash,block:deployment.blockNumber.toString(),blockHash:deployment.blockHash,status:deployment.status},approvals};
 fs.writeFileSync('/tmp/pumpfun-issue32-local-deployment.json',JSON.stringify(evidence,null,2));
 fs.writeFileSync('packages/nextjs/.env.local',`NEXT_PUBLIC_LOCAL_CHAIN=true\nNEXT_PUBLIC_TOKEN_FACTORY=${address}\nNEXT_TELEMETRY_DISABLED=1\n`);
 console.log(JSON.stringify(evidence,null,2));
})();
