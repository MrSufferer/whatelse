"use client";
import { SyntheticEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Address } from "@scaffold-ui/components";
import { decodeEventLog, encodeAbiParameters, keccak256, parseAbiParameters } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { LauncherEconomics } from "~~/components/LauncherEconomics";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { tokenFactoryAbi } from "~~/utils/launcher/abis";
import {
  configured,
  factoryAddress,
  fixtureName,
  fixtureSymbol,
  network,
  proposalId,
  revision,
} from "~~/utils/launcher/config";
import { getParsedError } from "~~/utils/scaffold-eth";

export default function Create() {
  const router = useRouter();
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: network.id });
  const [name, setName] = useState(fixtureName);
  const [symbol, setSymbol] = useState(fixtureSymbol);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: proposal, refetch } = useScaffoldReadContract({
    contractName: "TokenFactory",
    functionName: "proposals",
    args: [proposalId],
    query: { enabled: configured },
  });
  const { data: approved } = useScaffoldReadContract({
    contractName: "TokenFactory",
    functionName: "approvedLaunchers",
    args: [address],
    query: { enabled: configured && !!address },
  });
  const { data: platform } = useScaffoldReadContract({
    contractName: "TokenFactory",
    functionName: "platformRecipient",
    query: { enabled: configured },
  });
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "TokenFactory" });
  const terms =
    proposal && platform && address
      ? keccak256(
          encodeAbiParameters(parseAbiParameters("address, string, string, bytes32, address, address"), [
            address,
            name,
            symbol,
            revision,
            proposal[1],
            platform,
          ]),
        )
      : undefined;
  const eligible = !!(
    configured &&
    address &&
    chainId === network.id &&
    approved &&
    proposal?.[4] &&
    proposal[0].toLowerCase() === address.toLowerCase() &&
    proposal[2] === terms
  );
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!eligible || !client) return;
    setBusy(true);
    setStatus("Awaiting wallet approval…");
    try {
      const hash = await writeContractAsync({
        functionName: "createToken",
        args: [proposalId, name, symbol, revision],
      });
      if (!hash) throw new Error("No transaction submitted");
      setStatus("Checking canonical inclusion…");
      const receipt = await client.getTransactionReceipt({ hash });
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      if (receipt.status !== "success" || block.hash !== receipt.blockHash)
        throw new Error("Creation reverted or is no longer canonical");
      const event = receipt.logs
        .filter(log => log.address.toLowerCase() === factoryAddress?.toLowerCase())
        .map(log => {
          try {
            return decodeEventLog({ abi: tokenFactoryAbi, data: log.data, topics: log.topics });
          } catch {
            return undefined;
          }
        })
        .find(log => log?.eventName === "TokenCreated");
      if (
        !event ||
        event.eventName !== "TokenCreated" ||
        event.args.proposal !== proposalId ||
        event.args.chainId !== BigInt(network.id) ||
        event.args.launcher.toLowerCase() !== address?.toLowerCase()
      )
        throw new Error("Receipt has no matching creation event");
      router.push(`/token/${network.id}/${event.args.token}?tx=${hash}`);
    } catch (error) {
      setStatus(`Creation not completed: ${getParsedError(error)}`);
      await refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="launcher-page">
      <p className="eyebrow">Fictional proposal / reviewed creation</p>
      <h1>Start with a name.</h1>
      <p className="lead">
        Fictional Test Prediction Business. A test business solely for beta workflows, with no links or additional
        benefits.
      </p>
      <div className="launcher-spread">
        <LauncherEconomics trading={network.id === 31337} supportsSell={network.id === 31337} />
        <form className="launch-form" onSubmit={submit}>
          <h2>Create your test token</h2>
          <label htmlFor="name">Token name</label>
          <input
            id="name"
            className="input"
            autoComplete="off"
            required
            maxLength={64}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <label htmlFor="symbol">Symbol</label>
          <input
            id="symbol"
            className="input"
            autoComplete="off"
            required
            maxLength={12}
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
          />
          <p>Only the exact approved name and symbol can be created. Material changes require a new review.</p>
          {!configured ? (
            <p role="status">Factory unconfigured. No transaction can be submitted.</p>
          ) : !address ? (
            <p>Connect a wallet to check onchain creation permission. Connection is not interface authentication.</p>
          ) : chainId !== network.id ? (
            <p role="alert">
              Network mismatch. Select {network.name} (chain {network.id}) in your wallet. This app never switches
              automatically.
            </p>
          ) : !eligible ? (
            <p role="status">
              Creation unavailable: proposal is unapproved, revoked, already used, or does not match this wallet and
              form.
            </p>
          ) : (
            <p>Approved proposal matches your wallet and form.</p>
          )}
          <p>
            Network: {network.name} ({network.id}) · Transaction value: 0 ETH · No token allowance requested. Wallet
            displays estimated gas before signing; faucet ETH only.
          </p>
          {proposal && (
            <>
              <p>Launcher recipient</p>
              <Address address={proposal[1]} />
            </>
          )}
          {platform && (
            <>
              <p>Platform recipient</p>
              <Address address={platform} />
            </>
          )}
          <button className="btn btn-primary" disabled={!eligible || busy}>
            {busy ? "Checking creation…" : "Create zero-supply token"}
          </button>
          <p role="status" aria-live="polite" className="transaction-status">
            {status}
          </p>
        </form>
      </div>
    </div>
  );
}
