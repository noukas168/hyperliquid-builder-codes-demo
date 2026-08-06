import type { Chain } from "viem";
import { bsc } from "viem/chains";

export type ChainConfig = {
  key: string;
  label: string;
  chain: Chain;
  chainId: number;
  nativeSymbol: string;
  wrappedNative: `0x${string}`;
  /** Block explorer URL for a transaction hash. */
  txUrl: (hash: string) => string;
  /** Block explorer URL for an account or contract address. */
  addressUrl: (address: string) => string;
};

export const BNB_CHAIN: ChainConfig = {
  key: "bnb",
  label: "BNB Chain",
  chain: bsc,
  chainId: 56,
  nativeSymbol: "BNB",
  wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  txUrl: (hash) => `https://bscscan.com/tx/${hash}`,
  addressUrl: (address) => `https://bscscan.com/address/${address}`,
};

export const CHAINS = {
  bnb: BNB_CHAIN,
} as const;

export type ChainKey = keyof typeof CHAINS;

export const DEFAULT_CHAIN = BNB_CHAIN;
