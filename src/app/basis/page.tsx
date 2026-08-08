"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSwitchChain } from "wagmi";
import SwapCard from "@/components/SwapCard";
import { BNB_CHAIN } from "@/config/chains";

const ACCENT = "#E5341F";

export default function BasisPage() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  // Only ever true for a connected wallet, so nothing appears or disappears
  // on the path from no wallet to a wallet on the right chain.
  const wrongNetwork = isConnected && chainId !== BNB_CHAIN.chainId;

  return (
    <main className="min-h-screen bg-hl-bg px-6 py-16 font-body text-hl-text">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold text-white">Basis</h1>
          <p className="text-sm text-hl-muted">
            Non-custodial spot trading on {BNB_CHAIN.label}. Safety checks on every token, shown
            before you trade.
          </p>
        </header>

        <div className="flex justify-start">
          <ConnectButton />
        </div>

        {wrongNetwork && (
          <div className="flex flex-col gap-3 rounded-lg border border-hl-border bg-hl-card px-4 py-4">
            <p className="text-sm">
              Wrong network. This wallet is on chain {chainId ?? "unknown"}.
            </p>
            <button
              type="button"
              onClick={() => switchChain({ chainId: BNB_CHAIN.chainId })}
              disabled={isSwitching}
              style={{ backgroundColor: ACCENT }}
              className="self-start rounded-md px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSwitching ? "Switching…" : `Switch to ${BNB_CHAIN.label}`}
            </button>
            {switchError && <p className="text-xs text-hl-red">{switchError.message}</p>}
          </div>
        )}

        {/* No wallet gate. The card is fully usable read-only; only its final
            button needs an account. */}
        <SwapCard />
      </div>
    </main>
  );
}
