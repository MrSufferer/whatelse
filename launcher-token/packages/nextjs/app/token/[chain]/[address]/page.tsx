"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Address } from "@scaffold-ui/components";
import { decodeEventLog, formatUnits, isAddress, isHash } from "viem";
import { usePublicClient } from "wagmi";
import { LauncherChart } from "~~/components/LauncherChart";
import { LauncherEconomics } from "~~/components/LauncherEconomics";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { launcherTokenAbi, tokenFactoryAbi } from "~~/utils/launcher/abis";
import { configured, factoryAddress, network } from "~~/utils/launcher/config";

export default function Detail() {
  const params = useParams<{ chain: string; address: string }>();
  const search = useSearchParams();
  const hash = search.get("tx");
  const valid = params.chain === String(network.id) && isAddress(params.address);
  const token = valid ? (params.address as `0x${string}`) : undefined;
  const client = usePublicClient({ chainId: network.id });
  const { data: proposal, isError } = useScaffoldReadContract({
    contractName: "TokenFactory",
    functionName: "proposalOf",
    args: [token],
    query: { enabled: configured && valid },
  });
  const [info, setInfo] = useState<{
    name: string;
    symbol: string;
    supply: bigint;
    launcher: `0x${string}`;
    platform: `0x${string}`;
  }>();
  const [error, setError] = useState("");
  const [finality, setFinality] = useState(
    "Creation receipt unavailable. Registry membership alone does not verify transaction finality.",
  );
  const [blockNumber, setBlockNumber] = useState<bigint>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setInfo(undefined);
    setError("");
    if (!client || !token || !proposal || /^0x0+$/.test(proposal)) return;
    // Dynamic registry token addresses have no static Scaffold deployment entry. The network client comes from the same configured Wagmi provider.
    (async () => {
      try {
        const read = <T extends "name" | "symbol" | "totalSupply" | "launcherRecipient" | "platformRecipient">(
          functionName: T,
        ) => client.readContract({ address: token, abi: launcherTokenAbi, functionName });
        const [name, symbol, supply, launcher, platform] = await Promise.all([
          read("name"),
          read("symbol"),
          read("totalSupply"),
          read("launcherRecipient"),
          read("platformRecipient"),
        ]);
        if (active)
          setInfo({
            name: name as string,
            symbol: symbol as string,
            supply: supply as bigint,
            launcher: launcher as `0x${string}`,
            platform: platform as `0x${string}`,
          });
      } catch {
        if (active) setError("Token reads unavailable. Retry when the network is reachable.");
      }
    })();
    return () => {
      active = false;
    };
  }, [client, token, proposal, retry]);
  useEffect(() => {
    let active = true;
    setBlockNumber(undefined);
    setFinality("Creation receipt unavailable. Registry membership alone does not verify transaction finality.");
    if (!client || !token || !hash || !isHash(hash)) return;
    setFinality("Checking canonical creation receipt…");
    (async () => {
      try {
        const receipt = await client.getTransactionReceipt({ hash });
        const canonical = await client.getBlock({ blockNumber: receipt.blockNumber });
        if (receipt.status !== "success" || canonical.hash !== receipt.blockHash)
          throw new Error("Creation reverted or orphaned. This receipt cannot confirm creation.");
        const created = receipt.logs
          .filter(log => log.address.toLowerCase() === factoryAddress?.toLowerCase())
          .some(log => {
            try {
              const event = decodeEventLog({ abi: tokenFactoryAbi, data: log.data, topics: log.topics });
              return (
                event.eventName === "TokenCreated" &&
                event.args.token.toLowerCase() === token.toLowerCase() &&
                event.args.chainId === BigInt(network.id)
              );
            } catch {
              return false;
            }
          });
        if (!created) throw new Error("Receipt does not identify this registered token on this chain.");
        if (active) {
          setBlockNumber(receipt.blockNumber);
          setFinality("Included in a canonical L2 block · provisional; finality unverified.");
        }
        try {
          let head = await client.getBlock({ blockTag: "finalized" });
          if (head.number === null || head.number < receipt.blockNumber) return;
          // Verify ancestry by hashes, never a timer or fixed confirmation count. Bound RPC work; distant ancestry remains unverified.
          if (head.number - receipt.blockNumber > 256n) {
            if (active)
              setFinality("Canonical inclusion verified · finality unavailable: ancestry exceeds verification window.");
            return;
          }
          while (head.number !== null && head.number > receipt.blockNumber) {
            const child = head;
            head = await client.getBlock({ blockHash: child.parentHash });
            if (head.hash !== child.parentHash || head.number === null || head.number !== child.number! - 1n)
              throw new Error("Inconsistent finalized ancestry");
          }
          const current = await client.getBlock({ blockNumber: receipt.blockNumber });
          if (head.hash !== receipt.blockHash || current.hash !== receipt.blockHash)
            throw new Error("Receipt is not canonical under finalized head");
          if (active)
            setFinality("Creation finalized · verified canonical ancestry under the provider’s finalized head.");
        } catch {
          if (active)
            setFinality(
              "Included provisionally · finality unavailable or inconsistent. Recheck before treating creation as final.",
            );
        }
      } catch (e) {
        if (active) setFinality(e instanceof Error ? e.message : "Receipt unavailable; finality unverified.");
      }
    })();
    return () => {
      active = false;
    };
  }, [client, token, hash, retry]);
  return (
    <div className="launcher-page">
      <p className="eyebrow">{network.name} / registered launch</p>
      <h1>{info?.name || "Launcher Token"}</h1>
      {!valid ? (
        <p role="alert">Unsupported chain or invalid token address.</p>
      ) : !configured ? (
        <p>Registry unconfigured for this network.</p>
      ) : isError ? (
        <p role="alert">Registry unavailable.</p>
      ) : proposal && /^0x0+$/.test(proposal) ? (
        <p role="alert">Token is not registered by this factory.</p>
      ) : !info ? (
        <p role="status">{error || "Reading registered token…"}</p>
      ) : (
        <>
          <p className="lead">{info.symbol} · Creation-only fictional test fixture</p>
          <div className="token-identity">
            Identity: chain {network.id} / <Address address={token} />
          </div>
          <p role="status" aria-live="polite">
            {finality}
          </p>
          {blockNumber !== undefined && (
            <p>
              Creation block: <span className="numeric">{blockNumber.toString()}</span>
            </p>
          )}
          {hash && isHash(hash) && (
            <p className="tx-hash">
              Transaction:{" "}
              {network.blockExplorers?.default ? (
                <a href={`${network.blockExplorers.default.url}/tx/${hash}`} target="_blank" rel="noreferrer">
                  {hash}
                </a>
              ) : (
                hash
              )}
            </p>
          )}
          <button className="btn" onClick={() => setRetry(n => n + 1)}>
            Recheck chain status
          </button>
          <div className="launcher-spread">
            <section>
              <LauncherChart chainId={network.id} address={params.address} name={info.name} symbol={info.symbol} />
              <dl className="token-stats">
                <div>
                  <dt>Outstanding supply</dt>
                  <dd>{formatUnits(info.supply, 18)}</dd>
                </div>
                <div>
                  <dt>Curve reserve</dt>
                  <dd>0 ETH</dd>
                </div>
                <div>
                  <dt>Market cap</dt>
                  <dd>0 ETH</dd>
                </div>
              </dl>
            </section>
            <aside className="launch-form">
              <h2>Trading unavailable</h2>
              <p>
                This creation-only token has no mint, buy, sell or fee-claim functions. It cannot be upgraded. A later
                trading release needs a new reviewed deployment.
              </p>
              <p>Launcher fee recipient</p>
              <Address address={info.launcher} />
              <p>Platform fee recipient</p>
              <Address address={info.platform} />
            </aside>
          </div>
          <section className="activity">
            <h2>Trading activity</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Tokens</th>
                  <th>ETH</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4}>No trades. Trading is unavailable for this fixture.</td>
                </tr>
              </tbody>
            </table>
          </section>
          <LauncherEconomics />
        </>
      )}
      {error && (
        <button className="btn" onClick={() => setRetry(n => n + 1)}>
          Retry token reads
        </button>
      )}
    </div>
  );
}
