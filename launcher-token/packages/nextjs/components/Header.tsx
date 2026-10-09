"use client";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export const Header = () => (
  <header className="launcher-nav">
    <Link href="/" className="launcher-wordmark">
      whatelse<span> / launcher tokens</span>
    </Link>
    <nav aria-label="Main navigation">
      <Link href="/">Explore</Link>
      <Link href="/create">Create</Link>
      <Link href="/proposal">Proposal</Link>
      <Link href="/operator">Operator</Link>
    </nav>
    <ConnectButton chainStatus="name" showBalance={false} />
  </header>
);
