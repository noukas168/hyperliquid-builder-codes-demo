import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Per-route metadata for /basis.
 *
 * The root layout is shared with the Hyperliquid page at /, and both pages are
 * client components, which cannot export `metadata`. A segment layout is the
 * one place a title for this route alone can live; it overrides the root's for
 * everything under /basis and leaves / untouched.
 */
export const metadata: Metadata = {
  title: "Basis, non-custodial spot trading on BNB Chain",
  description:
    "Non-custodial spot trading on BNB Chain. Safety checks on every token, shown before you trade.",
};

export default function BasisLayout({ children }: { children: ReactNode }) {
  return children;
}
