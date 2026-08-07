"use client";

import { useEffect, useMemo } from "react";
import { type Address, erc20Abi, erc20Abi_bytes32, getAddress, hexToString, isAddress } from "viem";
import { useBytecode, useReadContracts } from "wagmi";
import { BNB_CHAIN } from "@/config/chains";
import type { TokenInfo } from "@/config/tokens";

/**
 * Session-lifetime cache, keyed by lowercased address. Module-level so it
 * survives component unmounts but dies on page reload — no localStorage.
 */
const tokenCache = new Map<string, TokenInfo>();

/** Some older tokens (MKR, SAI) return bytes32 instead of string. */
function decodeBytes32(value: `0x${string}`): string {
  try {
    const decoded = hexToString(value, { size: 32 });
    // bytes32 strings are right-padded with NUL bytes — cut at the first one.
    const nul = decoded.indexOf("\u0000");
    return (nul === -1 ? decoded : decoded.slice(0, nul)).trim();
  } catch {
    return "";
  }
}

export type UseTokenInfoResult = {
  token: TokenInfo | null;
  isLoading: boolean;
  error: string | null;
};

export function useTokenInfo(addressInput?: string): UseTokenInfoResult {
  const raw = addressInput?.trim() ?? "";
  const hasInput = raw.length > 0;

  // Checksum the address so cache keys and contract calls are consistent.
  const normalized = useMemo<Address | null>(() => {
    if (!hasInput || !isAddress(raw)) return null;
    return getAddress(raw);
  }, [raw, hasInput]);

  const isMalformed = hasInput && normalized === null;
  const cacheKey = normalized?.toLowerCase() ?? "";
  const cached = cacheKey ? (tokenCache.get(cacheKey) ?? null) : null;
  const shouldFetch = Boolean(normalized) && !cached;

  // ── Step 1: is there a contract here at all? ──
  const {
    data: bytecode,
    isLoading: bytecodeLoading,
    isError: bytecodeErrored,
  } = useBytecode({
    address: normalized ?? undefined,
    chainId: BNB_CHAIN.chainId,
    query: { enabled: shouldFetch },
  });

  const bytecodeResolved = shouldFetch && !bytecodeLoading && !bytecodeErrored;
  const hasBytecode = Boolean(bytecode && bytecode !== "0x");

  // ── Step 2: standard ERC-20 metadata, batched. allowFailure keeps one
  // reverting method from killing the whole read. ──
  const standard = useReadContracts({
    allowFailure: true,
    contracts: normalized
      ? [
          {
            address: normalized,
            abi: erc20Abi,
            functionName: "symbol",
            chainId: BNB_CHAIN.chainId,
          },
          { address: normalized, abi: erc20Abi, functionName: "name", chainId: BNB_CHAIN.chainId },
          {
            address: normalized,
            abi: erc20Abi,
            functionName: "decimals",
            chainId: BNB_CHAIN.chainId,
          },
        ]
      : [],
    query: { enabled: shouldFetch && bytecodeResolved && hasBytecode },
  });

  const symbolFailed = standard.data?.[0]?.status === "failure";
  const nameFailed = standard.data?.[1]?.status === "failure";
  const needsBytes32 = Boolean(standard.data) && (symbolFailed || nameFailed);

  // ── Step 3: bytes32 retry, only when the string read actually failed. ──
  const fallback = useReadContracts({
    allowFailure: true,
    contracts: normalized
      ? [
          {
            address: normalized,
            abi: erc20Abi_bytes32,
            functionName: "symbol",
            chainId: BNB_CHAIN.chainId,
          },
          {
            address: normalized,
            abi: erc20Abi_bytes32,
            functionName: "name",
            chainId: BNB_CHAIN.chainId,
          },
        ]
      : [],
    query: { enabled: shouldFetch && needsBytes32 },
  });

  const waitingOnFallback = needsBytes32 && (fallback.isLoading || !fallback.data);

  const decimalsResult = standard.data?.[2];
  const decimalsFailed = Boolean(standard.data) && decimalsResult?.status !== "success";

  const token = useMemo<TokenInfo | null>(() => {
    if (cached) return cached;
    if (!normalized || !standard.data || waitingOnFallback) return null;
    if (decimalsResult?.status !== "success") return null;

    const decimals = Number(decimalsResult.result);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) return null;

    let symbol = standard.data[0]?.status === "success" ? String(standard.data[0].result) : "";
    let name = standard.data[1]?.status === "success" ? String(standard.data[1].result) : "";

    if (!symbol && fallback.data?.[0]?.status === "success") {
      symbol = decodeBytes32(fallback.data[0].result as `0x${string}`);
    }
    if (!name && fallback.data?.[1]?.status === "success") {
      name = decodeBytes32(fallback.data[1].result as `0x${string}`);
    }

    // decimals is the real ERC-20 test; a missing symbol/name is survivable.
    if (!symbol) symbol = `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
    if (!name) name = "Unknown token";

    return { symbol, name, address: normalized, decimals };
  }, [cached, normalized, standard.data, fallback.data, decimalsResult, waitingOnFallback]);

  useEffect(() => {
    if (token && cacheKey) tokenCache.set(cacheKey, token);
  }, [token, cacheKey]);

  const isLoading = shouldFetch && (bytecodeLoading || standard.isLoading || waitingOnFallback);

  let error: string | null = null;
  if (isMalformed) {
    error = "That isn't a valid address. Paste a full 0x address — 42 characters.";
  } else if (bytecodeErrored) {
    error = "Couldn't reach BNB Chain to check this address. Try again.";
  } else if (bytecodeResolved && !hasBytecode) {
    error =
      "No contract at this address on BNB Chain. It may be a wallet address, or a token that only exists on another chain.";
  } else if (decimalsFailed) {
    error = "This contract doesn't behave like an ERC-20 token — it has no decimals().";
  } else if (!isLoading && standard.isError && !token) {
    error = "Couldn't read this token's details.";
  }

  return { token: cached ?? token, isLoading, error };
}
