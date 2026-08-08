import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Per-route metadata for /hyperliquid.
 *
 * The root layout now carries the BNB Chain title, since Basis is the root
 * route. This page is a client component and cannot export `metadata` itself,
 * so a segment layout keeps the Hyperliquid title with the Hyperliquid page.
 *
 * Nothing in the UI links here. It is reachable by URL only, and deliberately
 * so: it stays fully working without competing with Basis for the front door.
 */
export const metadata: Metadata = {
  title: "Basis, trading terminal on Hyperliquid",
  description: "Non-custodial trading terminal on Hyperliquid.",
};

export default function HyperliquidLayout({ children }: { children: ReactNode }) {
  return children;
}
