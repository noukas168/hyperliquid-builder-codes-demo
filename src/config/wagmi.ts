"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrum, arbitrumSepolia, bsc } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Basis",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  chains: [arbitrum, arbitrumSepolia, bsc],
  ssr: true,
});
