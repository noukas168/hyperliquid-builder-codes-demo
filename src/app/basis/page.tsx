"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import SwapCard from "@/components/SwapCard";
import { BNB_CHAIN } from "@/config/chains";

const ACCENT = "#E5341F";

export default function BasisPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  const onBnbChain = isConnected && chainId === BNB_CHAIN.chainId;

  const { data: balance, isLoading: balanceLoading } = useBalance({
    address,
    chainId: BNB_CHAIN.chainId,
    query: { enabled: Boolean(address) && onBnbChain },
  });

  return (
    <main className="min-h-screen bg-hl-bg px-6 py-16 font-body text-hl-text">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-bold text-white">
            Basis <span style={{ color: ACCENT }}>·</span> {BNB_CHAIN.label}
          </h1>
          <p className="text-sm text-hl-muted">
            Connect a wallet on {BNB_CHAIN.label} (chain {BNB_CHAIN.chainId}) to view your{" "}
            {BNB_CHAIN.nativeSymbol} balance.
          </p>
        </header>

        <div className="flex justify-start">
          <ConnectButton />
        </div>

        {!isConnected && (
          <p className="rounded-lg border border-hl-border bg-hl-card px-4 py-3 text-sm text-hl-muted">
            No wallet connected.
          </p>
        )}

        {isConnected && !onBnbChain && (
          <div className="flex flex-col gap-3 rounded-lg border border-hl-border bg-hl-card px-4 py-4">
            <p className="text-sm">Wrong network — connected to chain {chainId ?? "unknown"}.</p>
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

        {onBnbChain && address && (
          <dl className="flex flex-col divide-y divide-hl-border rounded-lg border border-hl-border bg-hl-card">
            <div className="flex flex-col gap-1 px-4 py-4">
              <dt className="text-xs uppercase tracking-wide text-hl-muted">Address</dt>
              <dd>
                <a
                  href={BNB_CHAIN.addressUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: ACCENT }}
                  className="break-all font-mono text-sm hover:underline"
                >
                  {address}
                </a>
              </dd>
            </div>
            <div className="flex flex-col gap-1 px-4 py-4">
              <dt className="text-xs uppercase tracking-wide text-hl-muted">Balance</dt>
              <dd className="font-mono text-2xl font-bold text-white">
                {balanceLoading
                  ? "…"
                  : balance
                    ? `${Number(balance.formatted).toFixed(6)} ${balance.symbol}`
                    : `— ${BNB_CHAIN.nativeSymbol}`}
              </dd>
            </div>
          </dl>
        )}

        {onBnbChain && <SwapCard />}
      </div>
    </main>
  );
}
