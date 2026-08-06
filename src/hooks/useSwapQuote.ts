"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type ZeroExFee = { amount: string; token: string; type: string } | null;

export type ZeroExPrice = {
  liquidityAvailable: boolean;
  buyAmount?: string;
  minBuyAmount?: string;
  sellAmount?: string;
  gas?: string;
  gasPrice?: string;
  totalNetworkFee?: string;
  /** v1 field. Read defensively — Swap API v2 does not document it. */
  estimatedPriceImpact?: string;
  fees?: { integratorFee?: ZeroExFee; zeroExFee?: ZeroExFee; gasFee?: ZeroExFee };
  issues?: { allowance?: { actual: string; spender: string } | null; balance?: unknown };
  route?: { fills?: Array<{ source: string; proportionBps?: string }> };
};

const DEBOUNCE_MS = 500;

export function useSwapQuote(args: {
  sellToken: string;
  buyToken: string;
  sellAmount: string; // base units
  taker?: string;
  slippageBps: number;
  enabled?: boolean;
}) {
  const { sellToken, buyToken, sellAmount, taker, slippageBps, enabled = true } = args;

  // Debounce the amount only — token/slippage changes should feel instant.
  const [debouncedAmount, setDebouncedAmount] = useState(sellAmount);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAmount(sellAmount), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [sellAmount]);

  const hasAmount = /^[0-9]+$/.test(debouncedAmount) && BigInt(debouncedAmount || "0") > BigInt(0);
  const isEnabled = enabled && hasAmount && sellToken !== buyToken;

  const query = useQuery<ZeroExPrice>({
    queryKey: ["0x-price", sellToken, buyToken, debouncedAmount, taker, slippageBps],
    enabled: isEnabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        chainId: "56",
        sellToken,
        buyToken,
        sellAmount: debouncedAmount,
        slippageBps: String(slippageBps),
      });
      if (taker) params.set("taker", taker);
      const res = await fetch(`/api/0x/price?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Could not fetch a price");
      return json as ZeroExPrice;
    },
  });

  const d = query.data;
  return {
    quote: d,
    buyAmount: d?.buyAmount,
    minBuyAmount: d?.minBuyAmount,
    integratorFee: d?.fees?.integratorFee ?? null,
    estimatedGas: d?.gas,
    totalNetworkFee: d?.totalNetworkFee,
    priceImpact: d?.estimatedPriceImpact,
    sources: d?.route?.fills?.map((f) => f.source) ?? [],
    allowanceIssue: d?.issues?.allowance ?? null,
    noLiquidity: d ? d.liquidityAvailable === false : false,
    // Stale-while-typing: the debounce gap counts as loading so the UI never
    // shows a number that belongs to a previous keystroke.
    isLoading: isEnabled && (query.isFetching || debouncedAmount !== sellAmount),
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
