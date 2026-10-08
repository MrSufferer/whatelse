"use client";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { configured, network } from "~~/utils/launcher/config";

function LaunchRow({ index }: { index: bigint }) {
  const { data } = useScaffoldReadContract({ contractName: "TokenFactory", functionName: "tokenAt", args: [index] });
  return (
    <div className="discovery-row">
      <span>Registered Launcher Token</span>
      {data ? (
        <>
          <Address address={data} />
          <Link href={`/token/${network.id}/${data}`}>Open token detail</Link>
        </>
      ) : (
        <span>Reading token…</span>
      )}
    </div>
  );
}
export default function Explore() {
  const {
    data: count,
    isLoading,
    isError,
    refetch,
  } = useScaffoldReadContract({
    contractName: "TokenFactory",
    functionName: "tokenCount",
    query: { enabled: configured },
  });
  return (
    <div className="launcher-page">
      <p className="eyebrow">Controlled beta / {network.name}</p>
      <h1>Communities, at the start.</h1>
      <p className="lead">
        Discover reviewed Launcher Tokens. This application currently verifies creation of fictional zero-supply test
        fixtures.
      </p>
      <Link className="btn btn-primary" href="/create">
        Review a Launch
      </Link>
      <section className="discovery">
        <h2>Registered launches</h2>
        {!configured ? (
          <p>Registry unconfigured. No deployment has been recorded for this network.</p>
        ) : isLoading ? (
          <p role="status">Reading registry…</p>
        ) : isError || count === undefined ? (
          <p role="alert">
            Registry unavailable.{" "}
            <button className="btn" onClick={() => refetch()}>
              Retry
            </button>
          </p>
        ) : count === 0n ? (
          <p>
            No launches registered yet. <Link href="/create">Review the approved fictional proposal</Link>.
          </p>
        ) : (
          <>
            {Array.from({ length: Number(count > 100n ? 100n : count) }, (_, i) => (
              <LaunchRow key={i} index={BigInt(i)} />
            ))}
            {count > 100n && <p>Showing the first 100 registered launches.</p>}
          </>
        )}
      </section>
      <p>
        Participant authentication and invitation management are unavailable in this creation test interface. Connecting
        a wallet proves no authenticated beta session or platform endorsement.
      </p>
    </div>
  );
}
