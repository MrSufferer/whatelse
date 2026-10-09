"use client";
import { useEffect, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { decodeEventLog, formatUnits, parseEther } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { LauncherChart } from "~~/components/LauncherChart";
import { useTransactor } from "~~/hooks/scaffold-eth";
import { launcherTokenAbi } from "~~/utils/launcher/abis";
import { network } from "~~/utils/launcher/config";
import { getParsedError, notification } from "~~/utils/scaffold-eth";

type Quote = {
  tokens: bigint;
  gross: bigint;
  fee: bigint;
  launcherFee: bigint;
  platformFee: bigint;
  refund: bigint;
  supply: bigint;
  timestamp: bigint;
};
type Snapshot = {
  supply: bigint;
  reserve: bigint;
  eth: bigint;
  holdings: bigint;
  balance: bigint;
  launcherFee: bigint;
  platformFee: bigint;
};
// ETH-only input and quote-block balance deliberately bypass EtherInput/Balance;
// see the narrow Scaffold UI exception in docs/implementation/issue-34-budget-buy.md.
// Display rounded values with an exact integer amount available in the title. No float enters trade math.
function Amount({ value, decimals = 18 }: { value: bigint; decimals?: number }) {
  const exact = formatUnits(value, decimals);
  const [whole, fraction] = exact.split(".");
  const shown = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction ? `.${fraction.slice(0, 12).replace(/0+$/, "") || "0"}` : ""}`;
  return (
    <span className="numeric" title={exact}>
      {value > 0n && shown === "0.0" ? "<0.000000000001" : shown}
    </span>
  );
}
export function LauncherBuy({
  token,
  name,
  symbol,
  launcher,
  platform,
}: {
  token: `0x${string}`;
  name: string;
  symbol: string;
  launcher: `0x${string}`;
  platform: `0x${string}`;
}) {
  const client = usePublicClient({ chainId: network.id });
  const { data: wallet } = useWalletClient();
  const { address, chainId } = useAccount();
  const transact = useTransactor();
  const [budget, setBudget] = useState("");
  const [slippage, setSlippage] = useState("100");
  const [quote, setQuote] = useState<Quote>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [clock, setClock] = useState(0);
  const [hash, setHash] = useState<`0x${string}`>();
  let budgetWei = 0n;
  try {
    if (/^(\d+)(\.\d{0,18})?$/.test(budget)) budgetWei = parseEther(budget);
  } catch {}
  const deadline = quote ? quote.timestamp + 300n : 0n;
  const minimum = quote ? (quote.tokens * (10000n - BigInt(slippage))) / 10000n : 0n;
  useEffect(() => {
    const timer = setInterval(() => setClock(Math.floor(Date.now() / 1000)), 1000);
    setClock(Math.floor(Date.now() / 1000));
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setQuote(undefined);
    setSnapshot(undefined);
    setError("");
    if (!client) return;
    async function load() {
      try {
        const block = await client!.getBlock();
        const blockNumber = block.number;
        const read = (functionName: "totalSupply" | "curveReserve" | "launcherFeesEarned" | "platformFeesEarned") =>
          client!.readContract({ address: token, abi: launcherTokenAbi, functionName, blockNumber });
        const [supply, reserve, launcherFee, platformFee, eth, holdings, balance] = await Promise.all([
          read("totalSupply"),
          read("curveReserve"),
          read("launcherFeesEarned"),
          read("platformFeesEarned"),
          client!.getBalance({ address: token, blockNumber }),
          address
            ? client!.readContract({
                address: token,
                abi: launcherTokenAbi,
                functionName: "balanceOf",
                args: [address],
                blockNumber,
              })
            : 0n,
          address ? client!.getBalance({ address, blockNumber }) : 0n,
        ]);
        if (!active) return;
        setSnapshot({ supply, reserve, launcherFee, platformFee, eth, holdings, balance });
        if (supply === 1_000_000n * 10n ** 18n) {
          setError("Supply Cap reached. Buying is unavailable.");
          return;
        }
        if (budget && budgetWei === 0n) {
          setError("Enter a positive ETH budget with at most 18 decimals.");
          return;
        }
        if (budgetWei > 0n) {
          const q = await client!.readContract({
            address: token,
            abi: launcherTokenAbi,
            functionName: "quoteBuy",
            args: [budgetWei],
            blockNumber,
          });
          if (active) setQuote(q);
        }
      } catch (e) {
        if (active) setError(`Quote unavailable. ${getParsedError(e)}`);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [client, token, address, budget, budgetWei, refresh]);
  const expired = !!quote && BigInt(clock) > deadline;
  const balanceError = !!address && !!snapshot && budgetWei > snapshot.balance;
  const ready = !!(
    network.id === 31337 &&
    address &&
    chainId === network.id &&
    wallet &&
    client &&
    quote &&
    snapshot &&
    !error &&
    !expired &&
    !balanceError &&
    !busy
  );
  async function buy() {
    if (!ready || !quote || !client || !wallet || !address) return;
    const signed = { minimum, deadline, budget: budgetWei };
    setBusy(true);
    setStatus("Checking signed minimum and deadline…");
    try {
      const { request } = await client.simulateContract({
        address: token,
        abi: launcherTokenAbi,
        functionName: "buy",
        args: [signed.minimum, signed.deadline],
        value: signed.budget,
        account: address,
      });
      const gas = await client.estimateContractGas(request);
      const gasPrice = await client.getGasPrice();
      if ((await client.getBalance({ address })) < signed.budget + (gas * gasPrice * 120n) / 100n)
        throw new Error("Insufficient ETH for the full budget plus estimated gas. Reduce the budget.");
      setStatus("Awaiting wallet approval…");
      const submitted = await transact(async () => {
        const txHash = await wallet.writeContract({ ...request, gas: (gas * 120n) / 100n });
        setHash(txHash);
        setStatus("Submitted · waiting for inclusion…");
        return txHash;
      });
      if (!submitted) throw new Error("Wallet rejected or transaction failed. No completed purchase verified.");
      const receipt = await client.getTransactionReceipt({ hash: submitted });
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      if (receipt.status !== "success" || block.hash !== receipt.blockHash)
        throw new Error("Purchase reverted or orphaned.");
      const bought = receipt.logs
        .filter(log => log.address.toLowerCase() === token.toLowerCase())
        .some(log => {
          try {
            const event = decodeEventLog({ abi: launcherTokenAbi, data: log.data, topics: log.topics });
            return (
              event.eventName === "Bought" &&
              event.args.buyer.toLowerCase() === address.toLowerCase() &&
              event.args.tokens >= signed.minimum
            );
          } catch {
            return false;
          }
        });
      if (!bought) throw new Error("Receipt does not verify the signed purchase.");
      setStatus("Buy included in a canonical block · finality unverified. Unused ETH refunded in this transaction.");
      setRefresh(n => n + 1);
    } catch (e) {
      const message = getParsedError(e);
      setStatus(`Purchase unsuccessful: ${message}`);
      notification.error(message);
      setRefresh(n => n + 1);
    } finally {
      setBusy(false);
    }
  }
  const spot = snapshot ? 1_000_000_000_000n + (18_000_000n * snapshot.supply) / 10n ** 18n : 0n;
  const quoteSpot = quote ? 1_000_000_000_000n + (18_000_000n * quote.supply) / 10n ** 18n : spot;
  const endpoint = quote ? 1_000_000_000_000n + (18_000_000n * (quote.supply + quote.tokens)) / 10n ** 18n : spot;
  return (
    <>
      <div className="launcher-spread">
        <section>
          <LauncherChart
            chainId={network.id}
            address={token}
            name={name}
            symbol={symbol}
            supply={quote?.supply ?? snapshot?.supply}
            proposedTokens={quote?.tokens}
          />
          <dl className="token-stats">
            {snapshot ? (
              <>
                <div>
                  <dt>Outstanding supply</dt>
                  <dd>
                    <Amount value={snapshot.supply} /> {symbol}
                  </dd>
                </div>
                <div>
                  <dt>Curve Reserve</dt>
                  <dd>
                    <Amount value={snapshot.reserve} /> ETH
                  </dd>
                </div>
                <div>
                  <dt>Contract ETH balance</dt>
                  <dd>
                    <Amount value={snapshot.eth} /> ETH
                  </dd>
                </div>
                <div>
                  <dt>Marginal price</dt>
                  <dd>
                    <Amount value={spot} /> ETH/token
                  </dd>
                </div>
                <div>
                  <dt>Market cap · display valuation</dt>
                  <dd>
                    <Amount value={(spot * snapshot.supply) / 10n ** 18n} /> ETH
                  </dd>
                </div>
                <div>
                  <dt>Your holdings</dt>
                  <dd>
                    {address ? (
                      <>
                        <Amount value={snapshot.holdings} /> {symbol}
                      </>
                    ) : (
                      "Connect wallet"
                    )}
                  </dd>
                </div>
              </>
            ) : (
              <p role="status">Reading curve accounting…</p>
            )}
          </dl>
          <p>
            Market cap is marginal price × outstanding supply. It is not reserve or business funding. Fees are separate
            liabilities; claims are not available in this release.
          </p>
        </section>
        <aside className="launch-form">
          <form
            onSubmit={event => {
              event.preventDefault();
              void buy();
            }}
            aria-busy={busy}
          >
            <p className="eyebrow">Local test only · buy-only release</p>
            <h2>Buy {symbol}</h2>
            <label htmlFor="eth-budget">ETH budget including fees</label>
            <input
              className="input"
              id="eth-budget"
              type="text"
              aria-invalid={!!error || balanceError}
              aria-describedby="budget-errors"
              inputMode="decimal"
              autoComplete="off"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              disabled={busy}
            />
            <p>
              Wallet ETH: {snapshot && address ? <Amount value={snapshot.balance} /> : "Connect wallet"}. Gas is
              additional.
            </p>
            <label htmlFor="slippage">Slippage tolerance</label>
            <select
              className="select"
              id="slippage"
              value={slippage}
              onChange={e => setSlippage(e.target.value)}
              disabled={busy}
            >
              <option value="100">1% · default</option>
              <option value="200">2% · higher tolerance</option>
              <option value="500">5% · higher tolerance</option>
            </select>
            {slippage !== "100" && (
              <p role="status">You explicitly selected higher tolerance. Fewer tokens may execute.</p>
            )}
            {quote && (
              <dl className="buy-breakdown">
                <div>
                  <dt>Net token output</dt>
                  <dd>
                    <Amount value={quote.tokens} /> {symbol}
                  </dd>
                </div>
                <div>
                  <dt>Gross curve value</dt>
                  <dd>
                    <Amount value={quote.gross} /> ETH
                  </dd>
                </div>
                <div>
                  <dt>Total fee · rounded up</dt>
                  <dd>
                    <Amount value={quote.fee} /> ETH
                  </dd>
                </div>
                <div>
                  <dt>Launcher share</dt>
                  <dd>
                    <Amount value={quote.launcherFee} /> ETH
                  </dd>
                </div>
                <div>
                  <dt>Platform share</dt>
                  <dd>
                    <Amount value={quote.platformFee} /> ETH
                  </dd>
                </div>
                <div>
                  <dt>Total charge</dt>
                  <dd>
                    <Amount value={quote.gross + quote.fee} /> ETH
                  </dd>
                </div>
                <div>
                  <dt>Unused ETH refund</dt>
                  <dd>
                    <Amount value={quote.refund} /> ETH
                  </dd>
                </div>
                <div>
                  <dt>Average execution price · including fee</dt>
                  <dd>
                    <Amount value={((quote.gross + quote.fee) * 10n ** 18n) / quote.tokens} /> ETH/token
                  </dd>
                </div>
                <div>
                  <dt>Endpoint marginal price · before fees</dt>
                  <dd>
                    <Amount value={endpoint} /> ETH/token
                  </dd>
                </div>
                <div>
                  <dt>Marginal price impact</dt>
                  <dd>
                    <Amount value={((endpoint - quoteSpot) * 10000n) / quoteSpot} decimals={2} />%
                  </dd>
                </div>
                <div>
                  <dt>Signed minimum output</dt>
                  <dd data-testid="minimum-output">
                    <span className="numeric">{formatUnits(minimum, 18)}</span> {symbol}
                  </dd>
                </div>
                <div>
                  <dt>Quote timestamp</dt>
                  <dd>{new Date(Number(quote.timestamp) * 1000).toISOString()}</dd>
                </div>
                <div>
                  <dt>Signed deadline · quote +300 seconds</dt>
                  <dd data-testid="quote-deadline">{new Date(Number(deadline) * 1000).toISOString()}</dd>
                </div>
              </dl>
            )}
            <p>
              Marginal price prices the next tiny unit before fees. Average execution price covers the entire supply
              interval and includes fees.
            </p>
            <p>
              Transaction ordering changes supply and output. Your wallet sends the entire ETH budget; unused ETH is
              returned. Gas is separate and can be spent on reverted transactions. ETH’s external value can change.
            </p>
            <p>
              No baseline business ownership, revenue, governance, wagering, access or outcome-payout rights; no
              promised appreciation. Future curve sell-back would use current value less fees, not your entry price.{" "}
              <strong>There is no operational sell path in this test release.</strong>
            </p>
            {network.id !== 31337 && (
              <p role="alert">Buying is restricted to the local test chain. No funded beta is authorized.</p>
            )}
            {!address && <p role="status">Connect wallet before buying.</p>}
            {address && chainId !== network.id && <p role="alert">Switch wallet to {network.name}.</p>}
            {error && (
              <p id="budget-errors" role="alert">
                {error}
              </p>
            )}
            {balanceError && (
              <p id={error ? undefined : "budget-errors"} role="alert">
                Insufficient ETH balance for this budget. Leave ETH for gas.
              </p>
            )}
            {expired && <p role="alert">Quote expired. Refresh before signing.</p>}
            <button type="button" className="btn" disabled={busy} onClick={() => setRefresh(n => n + 1)}>
              Refresh quote and balances
            </button>
            <button type="submit" className="btn btn-primary" disabled={!ready}>
              {busy ? "Purchase pending…" : "Buy with signed limits"}
            </button>
            <p role="status" aria-live="polite">
              {status}
            </p>
            {hash && <p className="tx-hash">Transaction: {hash}</p>}
            <p>Launcher fee recipient</p>
            <Address address={launcher} />
            <p>Platform fee recipient</p>
            <Address address={platform} />
            {snapshot && (
              <p>
                Earned / claimable (not withdrawable yet): Launcher <Amount value={snapshot.launcherFee} /> ETH;
                platform <Amount value={snapshot.platformFee} /> ETH. Claimed: 0 ETH.
              </p>
            )}
          </form>
        </aside>
      </div>
    </>
  );
}
