export function LauncherEconomics({ trading = false }: { trading?: boolean }) {
  return (
    <section className="economics" aria-label="Immutable economics">
      <h2>One permanent preset.</h2>
      <dl>
        <div>
          <dt>Reserve asset</dt>
          <dd>ETH</dd>
        </div>
        <div>
          <dt>Outstanding supply cap</dt>
          <dd>1,000,000 tokens</dd>
        </div>
        <div>
          <dt>Starting marginal price</dt>
          <dd>0.000001 ETH / token</dd>
        </div>
        <div>
          <dt>Linear slope</dt>
          <dd>0.000000000018 ETH / token per token</dd>
        </div>
        <div>
          <dt>Total trading fee</dt>
          <dd>1% of gross curve value</dd>
        </div>
        <div>
          <dt>Fee recipients</dt>
          <dd>Nominal 0.5% Launcher / 0.5% platform</dd>
        </div>
      </dl>
      <p>
        Integer rounding: fee rounds up; Launcher receives half rounded down, platform receives the remainder. Reserve
        backing is separate from fees and is never business funding.
      </p>
      <p>
        {trading ? (
          <>
            <strong>Local budget-buy test fixture.</strong> Supply starts at zero with no free allocation. Buys mint
            funded tokens. Sell-back and fee claims are unavailable in this release. No real funds or funded beta. The
            deployment is immutable.
          </>
        ) : (
          <>
            <strong>Creation-only test fixture.</strong> Supply starts at zero. Trading and fee claims are unavailable.
            This token cannot be upgraded; future trading requires a new reviewed deployment. No initial purchase or
            free allocation.
          </>
        )}
      </p>
      <p>
        No baseline business ownership, revenue, governance, redemption or prediction-market outcome-payout rights.
        Additional benefits: none.
      </p>
    </section>
  );
}
