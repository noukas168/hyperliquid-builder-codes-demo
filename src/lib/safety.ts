"use client";

import {
  type Address,
  createPublicClient,
  erc20Abi,
  http,
  parseAbi,
  parseUnits,
  toFunctionSelector,
  zeroAddress,
} from "viem";
import { bsc } from "viem/chains";
import { BNB_CHAIN } from "@/config/chains";
import type { CheckId, SafetyCheck } from "@/lib/safety-types";

/**
 * Client-side only: the tax and honeypot checks call our own /api/0x/*
 * proxy with a relative URL so the 0x key stays on the server.
 */
const publicClient = createPublicClient({ chain: bsc, transport: http() });

// TODO: verify on BscScan before mainnet use — PancakeSwap V2 factory.
const PANCAKE_V2_FACTORY: Address = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";

/** EIP-1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1 */
const EIP1967_IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;

const OWNABLE_ABI = parseAbi(["function owner() view returns (address)"]);
const FACTORY_ABI = parseAbi([
  "function getPair(address tokenA, address tokenB) view returns (address)",
]);

/**
 * Selectors are derived at module load rather than hardcoded, so they are
 * computed from the signatures instead of trusted from memory.
 */
const MINT_SIGNATURES = [
  "mint(address,uint256)",
  "mint(uint256)",
  "mint()",
  "mintTo(address,uint256)",
] as const;
const MINT_SELECTORS = MINT_SIGNATURES.map((sig) => toFunctionSelector(sig).slice(2).toLowerCase());

export type { CheckId, CheckStatus, SafetyCheck } from "@/lib/safety-types";

export type SafetyReport = {
  address: Address;
  checks: SafetyCheck[];
};

// ── Session cache. Transient failures are deliberately NOT cached, so a
// dropped RPC call doesn't pin a row to UNKNOWN for the whole session. ──
const cache = new Map<string, SafetyCheck>();
const key = (addr: string, id: CheckId) => `${addr.toLowerCase()}:${id}`;

async function cached(
  address: Address,
  id: CheckId,
  fn: () => Promise<{ check: SafetyCheck; transient?: boolean }>,
): Promise<SafetyCheck> {
  const hit = cache.get(key(address, id));
  if (hit) return hit;
  const { check, transient } = await fn();
  if (!transient) cache.set(key(address, id), check);
  return check;
}

export function clearSafetyCache() {
  cache.clear();
}

// ─────────────────────────── d) Ownership ───────────────────────────

export function checkOwnership(address: Address): Promise<SafetyCheck> {
  return cached(address, "ownership", async () => {
    try {
      const owner = await publicClient.readContract({
        address,
        abi: OWNABLE_ABI,
        functionName: "owner",
      });
      if (owner === zeroAddress) {
        return {
          check: {
            id: "ownership",
            label: "Ownership",
            status: "PASS",
            detail:
              "Ownership is renounced — owner() is the zero address, so owner-only functions can no longer be called. This does not rule out privileges built in elsewhere.",
            evidence: owner,
          },
        };
      }
      return {
        check: {
          id: "ownership",
          label: "Ownership",
          status: "WARN",
          detail:
            "One address still owns this contract and can call any owner-only function it defines. That may be routine, or it may include changing fees or freezing transfers.",
          evidence: owner,
        },
      };
    } catch {
      // No owner() is not the same as no privileged roles — AccessControl,
      // multisigs and custom modifiers are all invisible here.
      return {
        check: {
          id: "ownership",
          label: "Ownership",
          status: "UNKNOWN",
          detail:
            "This contract has no public owner() function. It may have no owner, or it may use a different permission system we cannot read from chain state.",
        },
      };
    }
  });
}

// ───────────────────────── c) Mint authority ─────────────────────────

export function checkMintAuthority(address: Address): Promise<SafetyCheck> {
  return cached(address, "mintAuthority", async () => {
    let bytecode: `0x${string}` | undefined;
    let implSlot: `0x${string}` | undefined;
    try {
      [bytecode, implSlot] = await Promise.all([
        publicClient.getCode({ address }),
        publicClient.getStorageAt({ address, slot: EIP1967_IMPL_SLOT }),
      ]);
    } catch {
      return {
        transient: true,
        check: {
          id: "mintAuthority",
          label: "Mint authority",
          status: "UNKNOWN",
          detail: "Could not read this contract's code from BNB Chain. Try again.",
        },
      };
    }

    if (!bytecode || bytecode === "0x") {
      return {
        check: {
          id: "mintAuthority",
          label: "Mint authority",
          status: "UNKNOWN",
          detail: "There is no contract code at this address.",
        },
      };
    }

    // A proxy's real logic lives elsewhere and can be swapped out, so
    // scanning this bytecode would tell you nothing.
    const isProxy = Boolean(implSlot && BigInt(implSlot) !== BigInt(0));
    if (isProxy) {
      return {
        check: {
          id: "mintAuthority",
          label: "Mint authority",
          status: "UNKNOWN",
          detail:
            "This is an upgradeable proxy. Its behaviour lives in another contract that the owner can replace, so what the code does today is no guide to tomorrow.",
          evidence: `implementation slot: ${implSlot}`,
        },
      };
    }

    const code = bytecode.slice(2).toLowerCase();
    const found = MINT_SIGNATURES.filter((_, i) => code.includes(MINT_SELECTORS[i]));

    if (found.length > 0) {
      return {
        check: {
          id: "mintAuthority",
          label: "Mint authority",
          status: "WARN",
          detail:
            "This contract's code contains a mint entrypoint, so new supply can probably be created. We cannot read who is allowed to call it, only that it exists.",
          evidence: found.join(", "),
        },
      };
    }

    return {
      check: {
        id: "mintAuthority",
        label: "Mint authority",
        status: "PASS",
        detail:
          "No standard mint entrypoint appears in this contract's code. Supply could still change through a differently named function, so this is not proof the supply is fixed.",
      },
    };
  });
}

// ────────────────────── b) Buy and sell tax ──────────────────────

const TAX_FAIL_BPS = 500;

export function checkTax(address: Address): Promise<SafetyCheck> {
  return cached(address, "tax", async () => {
    let meta: { buyTaxBps?: string; sellTaxBps?: string } | undefined;
    try {
      // Quote WBNB -> token so the token under test is the buyToken.
      const qs = new URLSearchParams({
        chainId: String(BNB_CHAIN.chainId),
        sellToken: BNB_CHAIN.wrappedNative,
        buyToken: address,
        sellAmount: parseUnits("0.01", 18).toString(),
      });
      const res = await fetch(`/api/0x/price?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "quote failed");
      meta = json?.tokenMetadata?.buyToken;
    } catch {
      return {
        transient: true,
        check: {
          id: "tax",
          label: "Transfer tax",
          status: "UNKNOWN",
          detail: "We could not get a price for this token, so its transfer tax is unknown.",
        },
      };
    }

    if (!meta || (meta.buyTaxBps === undefined && meta.sellTaxBps === undefined)) {
      return {
        check: {
          id: "tax",
          label: "Transfer tax",
          status: "UNKNOWN",
          detail: "No tax information was returned for this token.",
        },
      };
    }

    const buy = Number(meta.buyTaxBps ?? "0");
    const sell = Number(meta.sellTaxBps ?? "0");
    const worst = Math.max(buy, sell);
    const evidence = `buy ${(buy / 100).toFixed(2)}%, sell ${(sell / 100).toFixed(2)}%`;

    if (worst > TAX_FAIL_BPS) {
      return {
        check: {
          id: "tax",
          label: "Transfer tax",
          status: "FAIL",
          detail: `This token takes ${(worst / 100).toFixed(2)}% of every trade. That is a very large cut, and you lose it immediately on both buying and selling.`,
          evidence,
        },
      };
    }
    if (worst > 0) {
      return {
        check: {
          id: "tax",
          label: "Transfer tax",
          status: "WARN",
          detail: `This token takes a cut of each trade (${evidence}). You will receive less than the quoted amount.`,
          evidence,
        },
      };
    }
    return {
      check: {
        id: "tax",
        label: "Transfer tax",
        status: "PASS",
        detail:
          "No transfer tax was detected on a simulated trade. This comes from 0x's simulation, not from reading the contract, and a tax can be switched on later.",
        evidence,
      },
    };
  });
}

// ─────────────────────── a) Honeypot simulation ───────────────────────

export function checkHoneypot(address: Address): Promise<SafetyCheck> {
  return cached(address, "honeypot", async () => {
    const unknown = (detail: string, transient = false) => ({
      transient,
      check: {
        id: "honeypot" as const,
        label: "Can it be sold",
        status: "UNKNOWN" as const,
        detail,
      },
    });

    let pair: Address;
    let pairBalance: bigint;
    try {
      pair = await publicClient.readContract({
        address: PANCAKE_V2_FACTORY,
        abi: FACTORY_ABI,
        functionName: "getPair",
        args: [address, BNB_CHAIN.wrappedNative],
      });
      if (pair === zeroAddress) {
        return unknown(
          "This token has no direct PancakeSwap pair with WBNB, so we had no on-chain holder to simulate a sell from.",
        );
      }
      pairBalance = await publicClient.readContract({
        address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [pair],
      });
    } catch {
      return unknown("Could not reach BNB Chain to set up the sell simulation.", true);
    }

    if (pairBalance <= BigInt(0)) {
      return unknown("The liquidity pair holds none of this token, so there was nothing to sell.");
    }

    const sellAmount = pairBalance / BigInt(1000) || BigInt(1);

    let quote: {
      liquidityAvailable?: boolean;
      issues?: { allowance?: { spender: string } | null };
      transaction?: { to: string; data: string; value?: string };
    };
    try {
      const qs = new URLSearchParams({
        chainId: String(BNB_CHAIN.chainId),
        sellToken: address,
        buyToken: BNB_CHAIN.wrappedNative,
        sellAmount: sellAmount.toString(),
        taker: pair,
      });
      const res = await fetch(`/api/0x/quote?${qs.toString()}`);
      quote = await res.json();
      if (!res.ok) throw new Error("quote failed");
    } catch {
      return unknown("No sell route was available to simulate for this token.", true);
    }

    if (quote.liquidityAvailable === false || !quote.transaction?.to) {
      return unknown("No sell route was available to simulate for this token.");
    }

    // The only holder we can find on-chain has not approved the router, and
    // we will not fake an allowance to force the simulation through — a sell
    // that reverts on a missing approval says nothing about the token.
    if (quote.issues?.allowance) {
      return unknown(
        "We could not run a truthful sell simulation for this token. Nothing here says it is safe to sell.",
      );
    }

    try {
      await publicClient.call({
        account: pair,
        to: quote.transaction.to as Address,
        data: quote.transaction.data as `0x${string}`,
        value: quote.transaction.value ? BigInt(quote.transaction.value) : undefined,
      });
    } catch (err) {
      return {
        check: {
          id: "honeypot" as const,
          label: "Can it be sold",
          status: "FAIL" as const,
          detail:
            "A simulated sell of this token reverted on-chain. Tokens that can be bought but not sold work exactly like this.",
          evidence: err instanceof Error ? err.message.slice(0, 200) : undefined,
        },
      };
    }

    // Succeeded — but from the liquidity pair, which honeypots commonly
    // exempt. Not evidence that YOU could sell.
    return unknown(
      "A sell simulated successfully, but only from the liquidity pool, which these tokens often exempt from their own restrictions. This is not evidence that you could sell.",
    );
  });
}

// ─────────────────────────── Runner ───────────────────────────

/**
 * Runs every check in parallel. Individual checks are also exported so the
 * UI can render each row as it lands rather than waiting for the slowest.
 */
export async function checkToken(addressInput: Address): Promise<SafetyReport> {
  const checks = await Promise.all([
    checkHoneypot(addressInput),
    checkTax(addressInput),
    checkMintAuthority(addressInput),
    checkOwnership(addressInput),
  ]);
  return { address: addressInput, checks };
}
