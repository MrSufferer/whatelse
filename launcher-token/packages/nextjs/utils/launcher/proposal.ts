import { type Address, encodeAbiParameters, isAddress, keccak256, parseAbiParameters, stringToHex } from "viem";

export type ProposalTerms = {
  business: string;
  links: string[];
  description: string;
  benefits: string;
  name: string;
  symbol: string;
  launcherRecipient: Address;
  platformRecipient: Address;
  initialPurchase: "none";
};
export type ReviewedProposal = {
  id: `0x${string}`;
  family: string;
  predecessor: string | null;
  launcher: Address;
  revision: `0x${string}`;
  terms: ProposalTerms;
  source: string;
  created_at: string;
  action: "approve" | "reject" | "revoke" | null;
  reviewer: string | null;
  reviewed_at: string | null;
  token?: Address;
};
export function validateTerms(value: unknown): ProposalTerms {
  if (!value || typeof value !== "object") throw new Error("Proposal terms are required");
  const t = value as Record<string, unknown>;
  function field(key: string, max: number) {
    const s = t[key];
    if (typeof s !== "string" || !s.trim() || Buffer.byteLength(s, "utf8") > max)
      throw new Error(`${key} is required (maximum ${max} UTF-8 bytes)`);
    return s;
  }
  if (!Array.isArray(t.links) || t.links.length > 8) throw new Error("Use at most eight community links");
  const links = t.links.map(link => {
    if (typeof link !== "string" || link.length > 2048 || new URL(link).protocol !== "https:")
      throw new Error("Community links must use HTTPS");
    return link;
  });
  const launcherRecipient = field("launcherRecipient", 42);
  const platformRecipient = field("platformRecipient", 42);
  if (![launcherRecipient, platformRecipient].every(a => isAddress(a) && !/^0x0{40}$/i.test(a)))
    throw new Error("Both fixed recipients must be nonzero Ethereum addresses");
  if (t.initialPurchase !== "none") throw new Error("Initial purchase is unavailable in this creation-only release");
  return {
    business: field("business", 256),
    links,
    description: field("description", 8000),
    benefits: field("benefits", 8000),
    name: field("name", 64),
    symbol: field("symbol", 12),
    launcherRecipient: launcherRecipient.toLowerCase() as Address,
    platformRecipient: platformRecipient.toLowerCase() as Address,
    initialPurchase: "none",
  };
}
export function disclosureRevision(terms: ProposalTerms) {
  return keccak256(stringToHex(JSON.stringify(terms)));
}
export function proposalTermsHash(p: ReviewedProposal) {
  return keccak256(
    encodeAbiParameters(parseAbiParameters("address, string, string, bytes32, address, address"), [
      p.launcher,
      p.terms.name,
      p.terms.symbol,
      p.revision,
      p.terms.launcherRecipient,
      p.terms.platformRecipient,
    ]),
  );
}
