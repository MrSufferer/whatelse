"use client";
import { formatUnits } from "viem";

type LauncherChartProps = {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  supply?: bigint;
  proposedTokens?: bigint;
  direction?: "buy" | "sell";
};
export function LauncherChart({ symbol, supply = 0n, proposedTokens = 0n, direction = "buy" }: LauncherChartProps) {
  // Only pixel coordinates use floating point; quotes and amounts remain integer units.
  const position = (units: bigint) => 50 + Number((units * 520n) / 1_000_000_000_000_000_000_000_000n);
  const start = position(supply);
  const end = position(supply + (direction === "sell" ? -proposedTokens : proposedTokens));
  const priceY = (x: number) => 210 - ((x - 50) * 180) / 520;
  return (
    <section aria-label={`${symbol} bonding curve`}>
      <h2>Price versus outstanding supply</h2>
      <svg
        className="curve"
        role="img"
        aria-label={`Linear marginal price curve. Current supply ${formatUnits(supply, 18)} tokens. Proposed ${direction} ${formatUnits(proposedTokens, 18)} tokens.`}
        viewBox="0 0 600 260"
      >
        <path d="M50 20V220H580" fill="none" stroke="currentColor" />
        {proposedTokens > 0n && (
          <path
            data-testid={`${direction}-interval`}
            d={`M${start} 220L${start} ${priceY(start)}L${end} ${priceY(end)}L${end} 220Z`}
            fill={direction === "sell" ? "var(--launcher-pink)" : "var(--launcher-mint)"}
            opacity="0.25"
          />
        )}
        <path d="M50 210L570 30" fill="none" stroke="var(--launcher-mint)" strokeWidth="3" />
        <circle cx={start} cy={priceY(start)} r="6" fill="currentColor" />
        {proposedTokens > 0n && (
          <circle
            cx={end}
            cy={priceY(end)}
            r="6"
            fill={direction === "sell" ? "var(--launcher-pink)" : "var(--launcher-mint)"}
          />
        )}
        <text x="55" y="245">
          0 tokens
        </text>
        <text x="420" y="245">
          1,000,000 tokens
        </text>
        <text x="60" y="30">
          0.000019 ETH/token at cap
        </text>
      </svg>
      <p>
        White marker: current outstanding supply. {direction === "sell" ? "Pink" : "Mint"} area and endpoint: proposed{" "}
        {direction} interval. The area is gross curve value before fees.
      </p>
      <p>Mathematical marginal price curve, not trading history or a forecast.</p>
    </section>
  );
}
