"use client";
import { useState } from "react";
import Link from "next/link";
import { AddressInput } from "@scaffold-ui/components";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type Address, type Hex, encodeFunctionData, isAddress } from "viem";
import { useAccount } from "wagmi";
import { BetaAccess, BetaSignOut, useBetaSession } from "~~/components/BetaAccess";
import { ProposalRecord } from "~~/components/ProposalRecord";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { tokenFactoryAbi } from "~~/utils/launcher/abis";
import { betaApi } from "~~/utils/launcher/betaApi";
import { factoryAddress, network } from "~~/utils/launcher/config";
import { type ReviewedProposal } from "~~/utils/launcher/proposal";
import { getParsedError } from "~~/utils/scaffold-eth";

type Preview = { to: Address; data: Hex; chainId: number; value: string };
type Action =
  | {
      kind: "review";
      proposal: ReviewedProposal;
      action: "approve" | "reject" | "revoke";
      reason: string;
      source: string;
    }
  | {
      kind: "admission";
      address: Address;
      role: "launcher" | "participant";
      admitted: boolean;
      reason: string;
      source: string;
    };
function requestBody(action: Action) {
  return action.kind === "review" ? { ...action, proposal: action.proposal.id } : action;
}
function OperatorWorkflow() {
  const { address, chainId } = useAccount();
  const { session } = useBetaSession();
  const cache = useQueryClient();
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "TokenFactory" });
  const records = useQuery({
    queryKey: ["beta", "proposals", session?.address],
    queryFn: () => betaApi<ReviewedProposal[]>("proposals"),
  });
  const admissions = useQuery({
    queryKey: ["beta", "admissions", session?.address],
    queryFn: () => betaApi<unknown[]>("admission"),
  });
  const [target, setTarget] = useState("");
  const [role, setRole] = useState<"launcher" | "participant">("participant");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [pending, setPending] = useState<{ action: Action; preview: Preview }>();
  const [confirmation, setConfirmation] = useState<{ action: Action; hash: Hex }>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [history, setHistory] = useState<unknown>();
  async function prepare(action: Action) {
    setBusy(true);
    setStatus("");
    setPending(undefined);
    try {
      const result = await betaApi<Preview>(action.kind, requestBody(action));
      if (action.kind === "admission" && action.role === "participant") {
        setStatus("Participant admission saved.");
        await cache.invalidateQueries({ queryKey: ["beta"] });
      } else setPending({ action, preview: result });
    } catch (e) {
      setStatus(getParsedError(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveReceipt(record: { action: Action; hash: Hex }) {
    await betaApi(record.action.kind, { ...requestBody(record.action), transactionHash: record.hash });
    setConfirmation(undefined);
    setStatus("Canonical receipt recorded. Review history is preserved; inclusion is provisional.");
    await cache.invalidateQueries({ queryKey: ["beta"] });
  }
  async function sign() {
    if (!pending || !session || session.address.toLowerCase() !== address?.toLowerCase() || chainId !== network.id)
      return;
    setBusy(true);
    setStatus("");
    try {
      const a = pending.action;
      const fresh = await betaApi<Preview>(a.kind, requestBody(a));
      if (
        fresh.data !== pending.preview.data ||
        fresh.to.toLowerCase() !== factoryAddress?.toLowerCase() ||
        fresh.chainId !== chainId ||
        fresh.value !== "0"
      )
        throw new Error("Review changed. Prepare again.");
      const localData =
        a.kind === "review"
          ? encodeFunctionData({
              abi: tokenFactoryAbi,
              functionName: "reviewProposal",
              args: [
                a.proposal.id,
                a.proposal.launcher,
                a.proposal.terms.name,
                a.proposal.terms.symbol,
                a.proposal.revision,
                a.proposal.terms.launcherRecipient,
                a.action === "approve",
                a.reason,
              ],
            })
          : encodeFunctionData({
              abi: tokenFactoryAbi,
              functionName: "setLauncherApproval",
              args: [a.address, a.admitted, a.reason],
            });
      if (localData !== fresh.data) throw new Error("Transaction differs from the reviewed request");
      const hash =
        a.kind === "review"
          ? await writeContractAsync({
              functionName: "reviewProposal",
              args: [
                a.proposal.id,
                a.proposal.launcher,
                a.proposal.terms.name,
                a.proposal.terms.symbol,
                a.proposal.revision,
                a.proposal.terms.launcherRecipient,
                a.action === "approve",
                a.reason,
              ],
            })
          : await writeContractAsync({ functionName: "setLauncherApproval", args: [a.address, a.admitted, a.reason] });
      if (!hash) throw new Error("No transaction submitted");
      const record = { action: a, hash };
      setPending(undefined);
      setConfirmation(record);
      await saveReceipt(record);
    } catch (e) {
      setStatus(getParsedError(e));
    } finally {
      setBusy(false);
    }
  }
  const valid = !!reason.trim() && !!source.trim() && !busy && !confirmation;
  return (
    <>
      <BetaSignOut />
      <Link className="link" href="/operator/deploy">
        Manual Base Sepolia deployment preparation
      </Link>
      <section className="launch-form">
        <h2>Admission and review provenance</h2>
        <label>
          Reason (required)
          <textarea
            className="textarea"
            value={reason}
            maxLength={2000}
            onChange={e => {
              setReason(e.target.value);
              setPending(undefined);
            }}
          />
        </label>
        <label>
          Review source (required)
          <input
            className="input"
            value={source}
            maxLength={2000}
            autoComplete="off"
            onChange={e => {
              setSource(e.target.value);
              setPending(undefined);
            }}
          />
        </label>
        <h2>Invite or revoke interface access</h2>
        <label>
          Wallet (required)
          <AddressInput value={target} onChange={setTarget} />
        </label>
        <label>
          Role
          <select className="select" value={role} onChange={e => setRole(e.target.value as typeof role)}>
            <option value="participant">Participant</option>
            <option value="launcher">Launcher</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn"
            disabled={!valid || !isAddress(target)}
            onClick={() =>
              prepare({ kind: "admission", address: target as Address, role, admitted: true, reason, source })
            }
          >
            Approve / invite {role}
          </button>
          <button
            className="btn"
            disabled={!valid || !isAddress(target)}
            onClick={() =>
              prepare({ kind: "admission", address: target as Address, role, admitted: false, reason, source })
            }
          >
            Revoke {role} admission
          </button>
        </div>
        <p>
          Participant invitation changes interface access only. Launcher approval also updates onchain creation
          permission. Ownership, transfers and exit access remain available.
        </p>
      </section>
      <p role="status" aria-live="polite" className="transaction-status">
        {busy ? "Waiting for wallet / persistence…" : status}
      </p>
      {pending && (
        <section className="launch-form">
          <h2>Review before signing</h2>
          <p>
            Action:{" "}
            {pending.action.kind === "review"
              ? pending.action.action
              : pending.action.admitted
                ? "approve Launcher"
                : "revoke Launcher"}{" "}
            · {network.name} · transaction value: 0 ETH. Wallet displays gas; use faucet test ETH only.
          </p>
          <p>
            Reason: {pending.action.reason} · Source: {pending.action.source}
          </p>
          <label>
            Exact calldata
            <textarea className="textarea" readOnly value={pending.preview.data} />
          </label>
          <button className="btn btn-primary" disabled={busy} onClick={sign}>
            Review and sign in wallet
          </button>
          <button className="btn" onClick={() => setPending(undefined)} disabled={busy}>
            Cancel
          </button>
        </section>
      )}
      {confirmation && (
        <section className="launch-form">
          <p className="transaction-status">
            Signed transaction: {confirmation.hash}. If persistence failed, record this receipt before leaving; retry
            does not submit another transaction.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await saveReceipt(confirmation);
              } catch (e) {
                setStatus(getParsedError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Retry recording receipt
          </button>
        </section>
      )}
      <h2>Proposal review queue</h2>
      {records.isLoading && <p role="status">Reading review queue…</p>}
      {records.error && (
        <p role="alert">
          {records.error.message}
          <button className="btn" onClick={() => records.refetch()}>
            Retry
          </button>
        </p>
      )}
      {records.data?.length === 0 && (
        <p>No proposals submitted. A Launcher can submit their business and token terms from the Proposal page.</p>
      )}
      {records.data?.map(p => (
        <article key={p.id}>
          <ProposalRecord proposal={p} />
          <div className="flex flex-wrap gap-3">
            {(["approve", "reject", "revoke"] as const).map(action => (
              <button
                key={action}
                className="btn"
                disabled={!valid}
                onClick={() => prepare({ kind: "review", proposal: p, action, reason, source })}
              >
                {action} proposal
              </button>
            ))}
            <button
              className="btn"
              onClick={async () => {
                try {
                  setHistory(await betaApi(`history?proposal=${p.id}`));
                } catch (e) {
                  setStatus(getParsedError(e));
                }
              }}
            >
              View provenance
            </button>
          </div>
        </article>
      ))}
      {history !== undefined && <pre className="transaction-status">{JSON.stringify(history, null, 2)}</pre>}
      <h2>Admission history</h2>
      {admissions.isLoading && <p role="status">Reading admission history…</p>}
      {admissions.error && (
        <p role="alert">
          {admissions.error.message}
          <button className="btn" onClick={() => admissions.refetch()}>
            Retry
          </button>
        </p>
      )}
      {admissions.data?.length === 0 && <p>No admission changes recorded.</p>}
      {admissions.data && <pre className="transaction-status">{JSON.stringify(admissions.data, null, 2)}</pre>}
    </>
  );
}
export default function OperatorPage() {
  return (
    <div className="launcher-page">
      <p className="eyebrow">Operator / Controlled Beta</p>
      <h1>Review and admit.</h1>
      <BetaAccess role="operator">
        <OperatorWorkflow />
      </BetaAccess>
    </div>
  );
}
