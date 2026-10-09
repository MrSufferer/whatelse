"use client";
import { type SyntheticEvent, useState } from "react";
import Link from "next/link";
import { AddressInput } from "@scaffold-ui/components";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { BetaAccess, BetaSignOut, useBetaSession } from "~~/components/BetaAccess";
import { ProposalRecord } from "~~/components/ProposalRecord";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { betaApi } from "~~/utils/launcher/betaApi";
import { fixtureName, fixtureSymbol } from "~~/utils/launcher/config";
import { type ReviewedProposal } from "~~/utils/launcher/proposal";
import { getParsedError } from "~~/utils/scaffold-eth";

function ProposalForm() {
  const { address } = useAccount();
  const { session } = useBetaSession();
  const { data: platform } = useScaffoldReadContract({
    contractName: "TokenFactory",
    functionName: "platformRecipient",
  });
  const records = useQuery({
    queryKey: ["beta", "proposals", session?.address],
    queryFn: () => betaApi<ReviewedProposal[]>("proposals"),
    enabled: !!session,
  });
  const [recipient, setRecipient] = useState(address || "");
  const [predecessor, setPredecessor] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [history, setHistory] = useState<unknown>();
  async function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await betaApi("proposals", {
        predecessor: predecessor || undefined,
        source: data.get("source"),
        terms: {
          business: data.get("business"),
          description: data.get("description"),
          benefits: data.get("benefits"),
          links: String(data.get("links"))
            .split("\n")
            .map(s => s.trim())
            .filter(Boolean),
          name: data.get("name"),
          symbol: data.get("symbol"),
          launcherRecipient: recipient,
          platformRecipient: platform,
          initialPurchase: "none",
        },
      });
      setStatus("Proposal saved for operator review.");
      await records.refetch();
    } catch (e) {
      setStatus(getParsedError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <BetaSignOut />
      <form className="launch-form" onSubmit={submit} aria-busy={busy}>
        <h2>Submit a proposal</h2>
        <p>
          Each submission preserves a new immutable revision. Admission and operator review are required before
          creation. Initial purchases are unavailable in this creation-only release.
        </p>
        <label>
          Previous revision (optional)
          <select className="select" value={predecessor} onChange={e => setPredecessor(e.target.value)}>
            <option value="">New proposal</option>
            {records.data
              ?.filter(p => p.launcher.toLowerCase() === address?.toLowerCase())
              .map(p => (
                <option key={p.id} value={p.id}>
                  {p.terms.name} · {p.id.slice(0, 10)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Business identity (required)
          <input
            className="input"
            name="business"
            required
            maxLength={256}
            defaultValue="Fictional Test Prediction Business"
            autoComplete="organization"
          />
        </label>
        <label>
          Description (required)
          <textarea
            className="textarea"
            name="description"
            required
            maxLength={8000}
            defaultValue="Fictional prediction-market business used solely to exercise Launcher Token beta workflows."
          />
        </label>
        <label>
          Community links (HTTPS, one per line)
          <textarea className="textarea" name="links" autoComplete="off" />
        </label>
        <label>
          Benefit terms (required)
          <textarea
            className="textarea"
            name="benefits"
            required
            maxLength={8000}
            defaultValue="None. No baseline business or outcome-payout rights."
          />
        </label>
        <label>
          Token name (required)
          <input className="input" name="name" required maxLength={64} defaultValue={fixtureName} autoComplete="off" />
        </label>
        <label>
          Symbol (required)
          <input
            className="input"
            name="symbol"
            required
            maxLength={12}
            defaultValue={fixtureSymbol}
            autoComplete="off"
          />
        </label>
        <label>
          Fixed Launcher recipient (required)
          <AddressInput value={recipient} onChange={setRecipient} />
        </label>
        <label>
          Proposal source (required)
          <input
            className="input"
            name="source"
            required
            maxLength={2000}
            defaultValue="Launcher-submitted fictional beta fixture"
            autoComplete="off"
          />
        </label>
        <button className="btn btn-primary" disabled={busy || !platform}>
          {busy ? "Saving…" : "Submit for review"}
        </button>
        <p role="status" aria-live="polite">
          {status}
        </p>
      </form>
      <h2>Your proposals and revisions</h2>
      {records.isLoading && <p role="status">Reading proposals…</p>}
      {records.error && (
        <p role="alert">
          {records.error.message}
          <button className="btn" onClick={() => records.refetch()}>
            Retry
          </button>
        </p>
      )}
      {records.data?.length === 0 && <p>No proposals yet. Submit your business and token terms above.</p>}
      {records.data?.map(p => (
        <article key={p.id}>
          <ProposalRecord proposal={p} />
          {p.action === "approve" && (
            <Link className="btn" href={`/create?proposal=${p.id}`}>
              Create reviewed Launch
            </Link>
          )}
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
            View revision provenance
          </button>
        </article>
      ))}
      {history !== undefined && <pre className="transaction-status">{JSON.stringify(history, null, 2)}</pre>}
    </>
  );
}
export default function ProposalPage() {
  return (
    <div className="launcher-page">
      <p className="eyebrow">Launcher / proposal review</p>
      <h1>Describe your business.</h1>
      <BetaAccess role="signedIn">
        <ProposalForm />
      </BetaAccess>
    </div>
  );
}
