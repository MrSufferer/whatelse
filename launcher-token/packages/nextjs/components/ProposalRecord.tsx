import { Address } from "@scaffold-ui/components";
import { type ReviewedProposal } from "~~/utils/launcher/proposal";

export function ProposalRecord({ proposal: p }: { proposal: ReviewedProposal }) {
  return (
    <section className="launch-form">
      <h2>
        {p.terms.name} / {p.terms.symbol}
      </h2>
      <p>{p.terms.business}</p>
      <p>{p.terms.description}</p>
      <p>Benefit terms: {p.terms.benefits}</p>
      <ul>
        {p.terms.links.map(link => (
          <li key={link}>
            <a className="link" href={link} target="_blank" rel="noreferrer">
              {link}
            </a>
          </li>
        ))}
      </ul>
      <p>Initial purchase: none. Creation starts at zero supply.</p>
      <p>Launcher</p>
      <Address address={p.launcher} />
      <p>Fixed Launcher recipient</p>
      <Address address={p.terms.launcherRecipient} />
      <p>Fixed platform recipient</p>
      <Address address={p.terms.platformRecipient} />
      <p>Status: {p.action || "Awaiting review"}</p>
      <p>
        Source: {p.source} · Submitted: {new Date(p.created_at).toLocaleString()}
      </p>
      {p.reviewer && (
        <>
          <p>Reviewer</p>
          <Address address={p.reviewer} />
          <p>Reviewed: {p.reviewed_at && new Date(p.reviewed_at).toLocaleString()}</p>
        </>
      )}
      <p className="transaction-status">
        Proposal: {p.id}
        <br />
        Disclosure revision: {p.revision}
      </p>
      {p.predecessor && (
        <p className="transaction-status">
          Revises: {p.predecessor}. Each revision requires its own review; revoke a previously approved revision to
          retire it.
        </p>
      )}
    </section>
  );
}
