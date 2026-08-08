"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain } from "wagmi";
import BasisMark from "@/components/BasisMark";
import SwapCard from "@/components/SwapCard";
import { BNB_CHAIN } from "@/config/chains";

export default function BasisPage() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  // Only ever true for a connected wallet, so nothing appears or disappears
  // on the path from no wallet to a wallet on the right chain.
  const wrongNetwork = isConnected && chainId !== BNB_CHAIN.chainId;

  return (
    <div className="bs-surface min-h-screen bg-bs-n0 font-ui text-bs-n8 antialiased">
      {/* The single brand accent on the page, other than the mark and the
          primary action. A rule rather than a fill, so it frames the interface
          without competing with it. */}
      <div aria-hidden className="h-[2px] w-full bg-bs-brand" />

      {/* ── Header bar ──
          Identity and wallet, not a hero. Two tight rows at every width, so
          nothing reflows into a different arrangement on a narrow screen. */}
      {/* Full bleed rather than a centred column: the mark sits at the left
          edge and the wallet at the right, the way an application's chrome
          does, so the header frames the card instead of floating above it. */}
      <header className="border-bs-n4 border-b bg-bs-n0">
        <div className="w-full px-4 pt-3 pb-2.5 sm:px-5">
          <div className="flex items-center justify-between gap-4">
            {/* Logo lockup. The mark is one of the three permitted uses of
                brand red, alongside the rule above and the primary action; it
                takes the colour through currentColor rather than a fill, so it
                cannot drift from the token. The wordmark stays in the
                interface face and in a neutral, because a wordmark is
                identity, not signal. */}
            <div className="flex min-w-0 items-center gap-2">
              {/* Sized by its ink, not its box. The mark is wide and short,
                  24 x 12 inside a 32-unit square, so a square box the height of
                  the wordmark leaves it visibly undersized beside the text. At
                  36px the bars span 27 x 13.5, which sets the mark's ink height
                  against the wordmark's cap height at 20px. Both halves move
                  together; changing one alone breaks the lockup. */}
              <BasisMark className="h-9 w-9 shrink-0 text-bs-brand" />
              <h1 className="truncate font-semibold text-bs-n9 text-bs-xl">Basis</h1>
            </div>
            <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
          </div>
          <p className="mt-1 text-bs-n7 text-bs-xs">
            Non-custodial spot trading on {BNB_CHAIN.label}. Safety checks on every token, shown
            before you trade.
          </p>
        </div>
      </header>

      {/* ── Terminal body ──
          The card is the centre of gravity: centred, and held to a width that
          keeps a figure and its label on one readable line. */}
      <main className="mx-auto w-full max-w-[440px] px-4 py-6">
        {wrongNetwork && (
          <div className="mb-4 flex flex-col gap-2.5 border border-bs-warn/40 bg-bs-n1 px-3.5 py-3">
            <p className="text-bs-n8 text-bs-sm">
              Wrong network. This wallet is on chain {chainId ?? "unknown"}.
            </p>
            <button
              type="button"
              onClick={() => switchChain({ chainId: BNB_CHAIN.chainId })}
              disabled={isSwitching}
              className="self-start border border-bs-n5 bg-bs-n2 px-3 py-1.5 font-medium text-bs-n9 text-bs-sm transition-colors hover:bg-bs-n3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSwitching ? "Switching…" : `Switch to ${BNB_CHAIN.label}`}
            </button>
            {switchError && <p className="text-bs-alarm text-bs-xs">{switchError.message}</p>}
          </div>
        )}

        {/* No wallet gate. The card is fully usable read-only; only its final
            button needs an account. */}
        <SwapCard />
      </main>
    </div>
  );
}
