import type { Address } from "viem";

/**
 * 0x / EIP-7528 sentinel for a chain's native asset. Passed as sellToken or
 * buyToken to trade native BNB; it is NOT a real contract and must never be
 * used in an ERC-20 approve() call.
 */
export const NATIVE_TOKEN_SENTINEL: Address = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export type TokenInfo = {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  logoURI?: string;
};

/**
 * Tradable tokens on BNB Chain (chainId 56).
 *
 * DECIMALS WARNING: on BNB Chain, USDT and USDC are 18 decimals, not the
 * 6 decimals they use on Ethereum and Arbitrum. Getting this wrong misprices
 * a trade by 10^12.
 *
 * Every address and decimals value below was verified on BscScan on
 * 2026-08-06, and cross-checked by reading symbol/name/decimals directly
 * from each contract on chain 56.
 */
export const BNB_TOKENS: TokenInfo[] = [
  {
    symbol: "BNB",
    name: "BNB",
    // Standard native-asset sentinel, not a deployed contract, so there is
    // nothing on BscScan to verify against.
    address: NATIVE_TOKEN_SENTINEL,
    decimals: 18,
  },
  {
    symbol: "WBNB",
    name: "Wrapped BNB",
    // Verified on BscScan 2026-08-06: symbol WBNB, name "Wrapped BNB", 18 decimals.
    // https://bscscan.com/address/0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
    address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    decimals: 18,
  },
  {
    symbol: "USDT",
    name: "Tether USD (BSC-USD)",
    // Verified on BscScan 2026-08-06: symbol USDT, on-chain name "Tether USD".
    // https://bscscan.com/address/0x55d398326f99059fF775485246999027B3197955
    address: "0x55d398326f99059fF775485246999027B3197955",
    decimals: 18, // Verified 2026-08-06. 18 on BSC, unlike 6 on Ethereum.
  },
  {
    symbol: "USDC",
    name: "USD Coin (Binance-Peg)",
    // Verified on BscScan 2026-08-06: symbol USDC, on-chain name "USD Coin".
    // https://bscscan.com/address/0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18, // Verified 2026-08-06. 18 on BSC, unlike 6 on Ethereum.
  },
  {
    symbol: "CAKE",
    name: "PancakeSwap Token",
    // Verified on BscScan 2026-08-06: 18 decimals, name "PancakeSwap Token".
    // On-chain symbol is "Cake"; displayed here as CAKE, which is how the
    // project brands it.
    // https://bscscan.com/address/0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    decimals: 18,
  },
];

export function isNativeToken(address?: string): boolean {
  return address?.toLowerCase() === NATIVE_TOKEN_SENTINEL.toLowerCase();
}

export function getToken(address: string): TokenInfo | undefined {
  return BNB_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase());
}

export const DEFAULT_SELL_TOKEN = BNB_TOKENS[0]; // BNB
export const DEFAULT_BUY_TOKEN = BNB_TOKENS[2]; // USDT
