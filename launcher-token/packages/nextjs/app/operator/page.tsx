"use client";
import { useState } from "react";
import { Address, AddressInput } from "@scaffold-ui/components";
import {
  type Address as AddressType,
  type Hex,
  type TransactionReceipt,
  encodeDeployData,
  encodeFunctionData,
  formatEther,
  isAddress,
} from "viem";
import { baseSepolia } from "viem/chains";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useTransactor } from "~~/hooks/scaffold-eth";
import { tokenFactoryAbi } from "~~/utils/launcher/abis";
import { factoryAddress, fixtureName, fixtureSymbol, proposalId, revision } from "~~/utils/launcher/config";
import { operatorFactoryBytecode } from "~~/utils/launcher/operatorBytecode";

const OPERATOR = "0xeD37FD0d6F0f69236E7472B36796e133D20EcC32" as const;
type Step = "deploy" | "approve" | "review";
type Preview = {
  step: Step;
  account: AddressType;
  to?: AddressType;
  data: Hex;
  value: bigint;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  time: number;
};
export default function OperatorPage() {
  const { address, chainId, connector } = useAccount();
  const { data: wallet } = useWalletClient();
  const client = usePublicClient({ chainId: 84532 });
  const transact = useTransactor();
  const [factory, setFactory] = useState(factoryAddress ?? "");
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [faucet, setFaucet] = useState(false);
  const [receipts, setReceipts] = useState<TransactionReceipt[]>([]);
  const eligible =
    address?.toLowerCase() === OPERATOR.toLowerCase() &&
    chainId === 84532 &&
    connector?.name.toLowerCase().includes("metamask");
  async function verify() {
    if (!eligible || !wallet || !client)
      throw new Error("Connect the approved MetaMask account on Base Sepolia (84532).");
    const accounts = await wallet.getAddresses();
    if (
      accounts[0]?.toLowerCase() !== OPERATOR.toLowerCase() ||
      (await wallet.getChainId()) !== 84532 ||
      (await client.getChainId()) !== 84532
    )
      throw new Error("Wallet account or provider chain changed. Prepare again.");
    return { wallet, client };
  }
  async function prepare(step: Step) {
    setBusy(true);
    setError("");
    setPreview(undefined);
    try {
      const { client } = await verify();
      if (step !== "deploy") {
        if (!isAddress(factory)) throw new Error("Enter the factory from its successful deployment receipt.");
        // This address comes from a just-deployed receipt before static Scaffold configuration exists.
        // Network-bound reads recheck live owner/recipient permissions immediately before signing.
        const owner = await client.readContract({ address: factory, abi: tokenFactoryAbi, functionName: "owner" });
        const recipient = await client.readContract({
          address: factory,
          abi: tokenFactoryAbi,
          functionName: "platformRecipient",
        });
        if (owner.toLowerCase() !== OPERATOR.toLowerCase() || recipient.toLowerCase() !== OPERATOR.toLowerCase())
          throw new Error("Factory owner or platform recipient differs from the approved test identity.");
      }
      const to = step === "deploy" ? undefined : (factory as AddressType);
      const data =
        step === "deploy"
          ? encodeDeployData({ abi: tokenFactoryAbi, bytecode: operatorFactoryBytecode, args: [OPERATOR, OPERATOR] })
          : step === "approve"
            ? encodeFunctionData({
                abi: tokenFactoryAbi,
                functionName: "setLauncherApproval",
                args: [OPERATOR, true, "Approved fictional Base Sepolia test"],
              })
            : encodeFunctionData({
                abi: tokenFactoryAbi,
                functionName: "reviewProposal",
                args: [
                  proposalId,
                  OPERATOR,
                  fixtureName,
                  fixtureSymbol,
                  revision,
                  OPERATOR,
                  true,
                  "Reviewed fictional fixture; no additional benefits",
                ],
              });
      const fees = await client.estimateFeesPerGas();
      const gas = await client.estimateGas({ account: OPERATOR, to, data, value: 0n, ...fees });
      setPreview({
        step,
        account: OPERATOR,
        to,
        data,
        value: 0n,
        gas: (gas * 120n) / 100n,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        time: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preparation failed");
    } finally {
      setBusy(false);
    }
  }
  async function sign() {
    if (!preview || !faucet) return;
    setBusy(true);
    setError("");
    try {
      const { wallet } = await verify();
      if (Date.now() - preview.time > 120000 || (preview.to && preview.to.toLowerCase() !== factory.toLowerCase()))
        throw new Error("Preview expired or factory changed. Prepare again.");
      const request = {
        account: preview.account,
        to: preview.to,
        data: preview.data,
        value: preview.value,
        gas: preview.gas,
        maxFeePerGas: preview.maxFeePerGas,
        maxPriorityFeePerGas: preview.maxPriorityFeePerGas,
      };
      await transact(() => wallet.sendTransaction({ ...request, chain: baseSepolia }), {
        onBlockConfirmation: receipt => {
          setReceipts(previous => [...previous, receipt]);
          if (receipt.contractAddress) setFactory(receipt.contractAddress);
        },
      });
      setPreview(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="launcher-page">
      <p className="eyebrow">Manual operator / Base Sepolia 84532</p>
      <h1>Prepare the fictional test.</h1>
      <p className="lead">
        Review each transaction, then sign manually in MetaMask. Faucet test ETH only. Transaction value is zero; gas
        uses test ETH. Wallet connection is not application authentication.
      </p>
      <p>Approved deployer, operator, launcher and both recipients:</p>
      <Address address={OPERATOR} />
      {!eligible && (
        <p role="status">Connect the approved MetaMask account and select Base Sepolia with the wallet controls.</p>
      )}
      <label className="label">
        <input className="checkbox" type="checkbox" checked={faucet} onChange={e => setFaucet(e.target.checked)} />I am
        using faucet test ETH only.
      </label>
      <section className="launch-form">
        <h2>1. Deploy factory</h2>
        <p>Constructor operator and platform recipient both use the approved address.</p>
        <button className="btn" disabled={!eligible || busy} onClick={() => prepare("deploy")}>
          Prepare deployment
        </button>
        <h2>2. Approve launcher</h2>
        <label>
          Factory from successful deployment receipt
          <AddressInput
            value={factory}
            onChange={value => {
              setFactory(value);
              setPreview(undefined);
            }}
          />
        </label>
        <button className="btn" disabled={!eligible || busy || !isAddress(factory)} onClick={() => prepare("approve")}>
          Prepare launcher approval
        </button>
        <h2>3. Review fictional proposal</h2>
        <p>
          {fixtureName} / {fixtureSymbol}. No additional benefits. Launcher and recipient use the approved address.
        </p>
        <p>
          Proposal: <code>{proposalId}</code>
          <br />
          Revision: <code>{revision}</code>
        </p>
        <button className="btn" disabled={!eligible || busy || !isAddress(factory)} onClick={() => prepare("review")}>
          Prepare proposal review
        </button>
      </section>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <section className="launch-form">
          <h2>Exact transaction</h2>
          <p>Action: {preview.step}; chain: Base Sepolia (84532); account:</p>
          <Address address={preview.account} />
          {preview.to ? (
            <>
              <p>To:</p>
              <Address address={preview.to} />
            </>
          ) : (
            <p>To: contract creation (no recipient)</p>
          )}
          <p>
            Value: 0 wei. Gas limit (estimate + 20%): {preview.gas.toString()}. Maximum fee per gas:{" "}
            {preview.maxFeePerGas.toString()} wei. Priority fee cap: {preview.maxPriorityFeePerGas.toString()} wei.
          </p>
          <p>
            Execution gas cap: {formatEther(preview.gas * preview.maxFeePerGas)} test ETH. An L1 data fee may be added;
            review the total in MetaMask. Preview expires after two minutes.
          </p>
          <label>
            Exact calldata
            <textarea className="textarea w-full" rows={8} readOnly value={preview.data} />
          </label>
          <button className="btn btn-primary" disabled={busy || !eligible || !faucet} onClick={sign}>
            {busy ? "Waiting for wallet / receipt…" : "Review and sign in MetaMask"}
          </button>
        </section>
      )}
      <section>
        <h2>Receipts and provenance</h2>
        {receipts.length === 0 && <p>No transactions signed here. Preserve receipts before leaving this page.</p>}
        {receipts.map(receipt => (
          <article key={receipt.transactionHash}>
            <p>
              {receipt.status} · chain 84532 · block {receipt.blockNumber.toString()} · block hash {receipt.blockHash}
            </p>
            <a
              className="link"
              target="_blank"
              rel="noreferrer"
              href={`https://sepolia.basescan.org/tx/${receipt.transactionHash}`}
            >
              {receipt.transactionHash}
            </a>
            {receipt.contractAddress && <Address address={receipt.contractAddress} />}
            <p>
              Gas used: {receipt.gasUsed.toString()}; effective gas price: {receipt.effectiveGasPrice.toString()} wei.
            </p>
          </article>
        ))}
        <p>
          Record factory address, deployment transaction hash, block number/hash, chain ID, repository commit and
          compiler settings in deployment evidence. After deployment and both approvals succeed, set{" "}
          <code>NEXT_PUBLIC_TOKEN_FACTORY</code> to the factory address from the receipt, configure Base Sepolia, then
          restart or rebuild the frontend. Verify owner, launcher approval and proposal revision with contract reads
          before creating the Launch.
        </p>
      </section>
    </div>
  );
}
