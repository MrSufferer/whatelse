"use client";
import { type ReactNode, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignMessage } from "wagmi";
import { type BetaSession, betaApi } from "~~/utils/launcher/betaApi";
import { network } from "~~/utils/launcher/config";
import { getParsedError } from "~~/utils/scaffold-eth";

export function useBetaSession() {
  const { address, chainId } = useAccount();
  const query = useQuery({
    queryKey: ["beta", "session", address, chainId],
    queryFn: () => betaApi<BetaSession>("session"),
    retry: false,
    refetchInterval: 15000,
  });
  const session =
    !query.isError && query.data?.address.toLowerCase() === address?.toLowerCase() && chainId === network.id
      ? query.data
      : undefined;
  return { ...query, session };
}
export function BetaAccess({
  role,
  children,
}: {
  role: "participant" | "launcher" | "operator" | "signedIn";
  children: ReactNode;
}) {
  const { address, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { session, isLoading, error, refetch } = useBetaSession();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function signIn() {
    setBusy(true);
    setStatus("");
    try {
      const { message } = await betaApi<{ message: string }>("challenge", { address, chainId });
      const signature = await signMessageAsync({ message });
      await betaApi("verify", { message, signature });
      await cache.invalidateQueries({ queryKey: ["beta"] });
    } catch (e) {
      setStatus(getParsedError(e));
    } finally {
      setBusy(false);
    }
  }
  if (isLoading)
    return (
      <section className="launch-form" role="status">
        Checking beta session…
      </section>
    );
  const allowed = session && (role === "signedIn" || session[role]);
  if (allowed) return <>{children}</>;
  return (
    <section className="launch-form">
      <h2>{session ? "Admission required" : "Sign in to the Controlled Beta"}</h2>
      <p>
        {!address
          ? "Connect your wallet first."
          : chainId !== network.id
            ? `Select ${network.name} in your wallet.`
            : session
              ? `This wallet does not have ${role} access. Ask the operator to review admission.`
              : "Sign a fresh login message. It grants no token approvals or transfers."}
      </p>
      {!session && (
        <button className="btn btn-primary" disabled={!address || chainId !== network.id || busy} onClick={signIn}>
          {busy ? "Waiting for signature…" : "Sign in with wallet"}
        </button>
      )}
      {session && (
        <Link className="link" href="/proposal">
          Submit or inspect your proposal
        </Link>
      )}
      <button className="btn" onClick={() => refetch()} disabled={busy}>
        Check access again
      </button>
      <p role="alert">{status || (error && !session ? error.message : "")}</p>
      <p>
        Admission applies to this interface. Your token detail, ownership, transfers and direct contract access remain
        available.
      </p>
    </section>
  );
}
export function BetaSignOut() {
  const cache = useQueryClient();
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="btn"
        onClick={async () => {
          try {
            await betaApi("session", undefined, "DELETE");
            cache.removeQueries({ queryKey: ["beta"] });
            await cache.invalidateQueries({ queryKey: ["beta"] });
          } catch (e) {
            setError(getParsedError(e));
          }
        }}
      >
        Sign out
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
