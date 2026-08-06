"use client";

import { useCallback, useEffect, useState } from "react";
import { erc20Abi } from "viem";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { BNB_CHAIN } from "@/config/chains";
import { isNativeToken } from "@/config/tokens";

export type SwapStatus =
  | "idle"
  | "quoting"
  | "awaiting-approval-signature"
  | "approval-pending"
  | "awaiting-signature"
  | "pending"
  | "success"
  | "failed"
  | "rejected";

function isUserRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string; cause?: { code?: number } };
  return (
    e.name === "UserRejectedRequestError" ||
    e.cause?.code === 4001 ||
    /user rejected|user denied/i.test(e.message ?? "")
  );
}

export function useSwapExecution() {
  const { address, isConnected, chainId } = useAccount();
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [swapHash, setSwapHash] = useState<`0x${string}` | undefined>();
  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>();

  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  const { isSuccess: approvalConfirmed, isError: approvalReverted } = useWaitForTransactionReceipt({
    hash: approvalHash,
    chainId: BNB_CHAIN.chainId,
  });
  const {
    isSuccess: swapConfirmed,
    isError: swapReverted,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: swapHash, chainId: BNB_CHAIN.chainId });

  // Bail out if the wallet disconnects or leaves BNB Chain mid-flow.
  const inFlight =
    status === "awaiting-approval-signature" ||
    status === "approval-pending" ||
    status === "awaiting-signature" ||
    status === "quoting";
  useEffect(() => {
    if (!inFlight) return;
    if (!isConnected) {
      setStatus("failed");
      setError("Wallet disconnected — nothing was submitted.");
    } else if (chainId !== BNB_CHAIN.chainId) {
      setStatus("failed");
      setError("Network changed away from BNB Chain — the flow was cancelled.");
    }
  }, [inFlight, isConnected, chainId]);

  useEffect(() => {
    if (approvalConfirmed && status === "approval-pending") setStatus("idle");
    if (approvalReverted && status === "approval-pending") {
      setStatus("failed");
      setError("The approval transaction reverted.");
    }
  }, [approvalConfirmed, approvalReverted, status]);

  useEffect(() => {
    if (swapConfirmed && status === "pending") {
      // A mined transaction can still have reverted — check the receipt status.
      setStatus(receipt?.status === "reverted" ? "failed" : "success");
      if (receipt?.status === "reverted") setError("The swap transaction reverted on-chain.");
    }
    if (swapReverted && status === "pending") {
      setStatus("failed");
      setError("The swap transaction reverted on-chain.");
    }
  }, [swapConfirmed, swapReverted, receipt, status]);

  /** Approve EXACTLY sellAmount to the AllowanceHolder spender from the quote. */
  const approve = useCallback(
    async (sellToken: `0x${string}`, spender: `0x${string}`, exactAmount: bigint) => {
      if (isNativeToken(sellToken)) return; // native needs no approval
      setError(null);
      setStatus("awaiting-approval-signature");
      try {
        const hash = await writeContractAsync({
          address: sellToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, exactAmount], // exact, never MaxUint256
          chainId: BNB_CHAIN.chainId,
        });
        setApprovalHash(hash);
        setStatus("approval-pending");
      } catch (err) {
        setStatus(isUserRejection(err) ? "rejected" : "failed");
        setError(isUserRejection(err) ? "You rejected the approval." : "The approval failed.");
      }
    },
    [writeContractAsync],
  );

  /** Fetch a firm quote, then send its calldata. */
  const swap = useCallback(
    async (params: {
      sellToken: string;
      buyToken: string;
      sellAmount: string;
      slippageBps: number;
    }) => {
      if (!address) return;
      setError(null);
      setSwapHash(undefined);
      setStatus("quoting");

      let quote: {
        liquidityAvailable?: boolean;
        transaction?: { to: string; data: string; value?: string; gas?: string };
        issues?: { allowance?: { actual: string; spender: string } | null };
      };
      try {
        const qs = new URLSearchParams({
          chainId: String(BNB_CHAIN.chainId),
          sellToken: params.sellToken,
          buyToken: params.buyToken,
          sellAmount: params.sellAmount,
          slippageBps: String(params.slippageBps),
          taker: address,
        });
        const res = await fetch(`/api/0x/quote?${qs.toString()}`);
        quote = await res.json();
        if (!res.ok) throw new Error((quote as { error?: string })?.error ?? "Quote failed");
      } catch (err) {
        setStatus("failed");
        setError(err instanceof Error ? err.message : "Could not fetch a firm quote.");
        return;
      }

      if (quote.liquidityAvailable === false || !quote.transaction?.to) {
        setStatus("failed");
        setError("No liquidity available for this trade right now.");
        return;
      }
      // Re-check on the FIRM quote: allowance may have lapsed since the price call.
      if (quote.issues?.allowance) {
        setStatus("failed");
        setError("Token approval is still required — approve, then swap again.");
        return;
      }

      setStatus("awaiting-signature");
      try {
        const hash = await sendTransactionAsync({
          to: quote.transaction.to as `0x${string}`,
          data: quote.transaction.data as `0x${string}`,
          value: quote.transaction.value ? BigInt(quote.transaction.value) : undefined,
          gas: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
          chainId: BNB_CHAIN.chainId,
        });
        setSwapHash(hash);
        setStatus("pending");
      } catch (err) {
        setStatus(isUserRejection(err) ? "rejected" : "failed");
        setError(isUserRejection(err) ? "You rejected the swap." : "The swap could not be sent.");
      }
    },
    [address, sendTransactionAsync],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setSwapHash(undefined);
    setApprovalHash(undefined);
  }, []);

  return { status, error, swapHash, approvalHash, approve, swap, reset, approvalConfirmed };
}
