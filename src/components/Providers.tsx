"use client";

import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";

import type { NetworkKey } from "@/config/constants";
import { wagmiConfig } from "@/config/wagmi";
import { AgentWalletProviderInner } from "@/hooks/useAgentWallet";
import { NetworkContext } from "@/hooks/useNetwork";

const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<NetworkKey>("mainnet");

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          /**
           * Neutral, not coloured. This theme paints the connect button and the
           * account chip, which is where the wallet address is rendered. A
           * semantic colour there would give that colour a second meaning: the
           * green previously used here is the success colour, and an address is
           * not a success. The brand red is equally wrong, since it belongs to
           * the mark and the primary action alone.
           *
           * Shared with the Hyperliquid wizard, which picks up the same neutral
           * treatment.
           */
          theme={darkTheme({
            accentColor: "#1E2227",
            accentColorForeground: "#E8EBEF",
            borderRadius: "medium",
          })}
        >
          <NetworkContext.Provider value={{ network, setNetwork }}>
            <AgentWalletProviderInner>{children}</AgentWalletProviderInner>
          </NetworkContext.Provider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
