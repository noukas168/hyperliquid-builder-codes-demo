"use client";

import { useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { BNB_CHAIN } from "@/config/chains";
import {
  BNB_TOKENS,
  DEFAULT_BUY_TOKEN,
  DEFAULT_SELL_TOKEN,
  getToken,
  isNativeToken,
  type TokenInfo,
} from "@/config/tokens";
import { useSwapExecution } from "@/hooks/useSwapExecution";
import { useSwapQuote } from "@/hooks/useSwapQuote";

const ACCENT = "#E5341F";
const SLIPPAGE_PRESETS = [50, 100, 300]; // bps → 0.5%, 1%, 3%
const HIGH_SLIPPAGE_BPS = 500; // above 5% we shout
const NATIVE_GAS_BUFFER = parseUnits("0.005", 18); // leave room for gas on MAX

export default function SwapCard() {
  const { address, isConnected, chainId } = useAccount();
  const [sellToken, setSellToken] = useState<TokenInfo>(DEFAULT_SELL_TOKEN);
  const [buyToken, setBuyToken] = useState<TokenInfo>(DEFAULT_BUY_TOKEN);
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100); // default 1%
  const [customSlippage, setCustomSlippage] = useState("");

  const onBnbChain = isConnected && chainId === BNB_CHAIN.chainId;

  const { data: nativeBalance } = useBalance({
    address,
    chainId: BNB_CHAIN.chainId,
    query: { enabled: Boolean(address) && isNativeToken(sellToken.address) },
  });
  const { data: erc20Balance } = useReadContract({
    address: sellToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: BNB_CHAIN.chainId,
    query: { enabled: Boolean(address) && !isNativeToken(sellToken.address) },
  });
  const balance = isNativeToken(sellToken.address) ? nativeBalance?.value : erc20Balance;

  const sellAmountBase = useMemo(() => {
    if (!amount || Number(amount) <= 0) return "0";
    try {
      return parseUnits(amount, sellToken.decimals).toString();
    } catch {
      return "0";
    }
  }, [amount, sellToken.decimals]);

  const {
    buyAmount,
    minBuyAmount,
    integratorFee,
    estimatedGas,
    priceImpact,
    sources,
    allowanceIssue,
    noLiquidity,
    isLoading,
    error: quoteError,
    refetch,
  } = useSwapQuote({
    sellToken: sellToken.address,
    buyToken: buyToken.address,
    sellAmount: sellAmountBase,
    taker: address,
    slippageBps,
    enabled: onBnbChain,
  });

  const {
    status,
    error: execError,
    swapHash,
    approve,
    swap,
    reset,
    approvalConfirmed,
  } = useSwapExecution();

  // Once an approval confirms, refresh the quote so issues.allowance clears.
  useEffect(() => {
    if (approvalConfirmed) refetch();
  }, [approvalConfirmed, refetch]);

  const needsApproval = Boolean(allowanceIssue) && !isNativeToken(sellToken.address);
  const busy =
    status !== "idle" && status !== "success" && status !== "failed" && status !== "rejected";

  const handleMax = () => {
    if (balance === undefined) return;
    let spendable = balance;
    if (isNativeToken(sellToken.address)) {
      spendable = balance > NATIVE_GAS_BUFFER ? balance - NATIVE_GAS_BUFFER : BigInt(0);
    }
    setAmount(formatUnits(spendable, sellToken.decimals));
  };

  const handleFlip = () => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setAmount("");
    reset();
  };

  const applyCustomSlippage = (raw: string) => {
    setCustomSlippage(raw);
    const pct = Number(raw);
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) setSlippageBps(Math.round(pct * 100));
  };

  const fmt = (v?: string, d = 18) => (v ? Number(formatUnits(BigInt(v), d)).toFixed(6) : "—");

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-hl-border bg-hl-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold text-white">Swap</h2>
        <span className="text-xs text-hl-muted">via 0x · BNB Chain</span>
      </div>

      {/* ── Sell ── */}
      <div className="flex flex-col gap-2 rounded-md border border-hl-border bg-hl-bg p-3">
        <div className="flex items-center justify-between text-xs text-hl-muted">
          <span>You pay</span>
          <span>
            Balance:{" "}
            {balance !== undefined
              ? Number(formatUnits(balance, sellToken.decimals)).toFixed(6)
              : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => {
              if (/^[0-9]*\.?[0-9]*$/.test(e.target.value)) setAmount(e.target.value);
            }}
            className="min-w-0 flex-1 bg-transparent font-mono text-2xl text-white outline-none"
          />
          <button
            type="button"
            onClick={handleMax}
            style={{ color: ACCENT }}
            className="rounded border border-current px-2 py-1 text-xs font-semibold"
          >
            MAX
          </button>
          <select
            value={sellToken.address}
            onChange={(e) => {
              const next = getToken(e.target.value);
              if (next) setSellToken(next);
            }}
            className="rounded bg-hl-input-bg px-2 py-1 text-sm text-white outline-none"
          >
            {BNB_TOKENS.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={handleFlip}
        aria-label="Flip tokens"
        className="self-center rounded-full border border-hl-border bg-hl-bg px-3 py-1 text-sm text-white"
      >
        ↓↑
      </button>

      {/* ── Buy ── */}
      <div className="flex flex-col gap-2 rounded-md border border-hl-border bg-hl-bg p-3">
        <div className="flex items-center justify-between text-xs text-hl-muted">
          <span>You receive (estimated)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-2xl text-white">
            {isLoading ? "…" : fmt(buyAmount, buyToken.decimals)}
          </span>
          <select
            value={buyToken.address}
            onChange={(e) => {
              const next = getToken(e.target.value);
              if (next) setBuyToken(next);
            }}
            className="rounded bg-hl-input-bg px-2 py-1 text-sm text-white outline-none"
          >
            {BNB_TOKENS.map((t) => (
              <option key={t.address} value={t.address}>
                {t.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Slippage ── */}
      <div className="flex flex-col gap-2">
        <span className="text-xs text-hl-muted">Max slippage</span>
        <div className="flex flex-wrap items-center gap-2">
          {SLIPPAGE_PRESETS.map((bps) => (
            <button
              key={bps}
              type="button"
              onClick={() => {
                setSlippageBps(bps);
                setCustomSlippage("");
              }}
              style={slippageBps === bps ? { backgroundColor: ACCENT } : undefined}
              className={`rounded px-3 py-1 text-xs font-semibold ${
                slippageBps === bps ? "text-white" : "border border-hl-border text-hl-text"
              }`}
            >
              {bps / 100}%
            </button>
          ))}
          <input
            value={customSlippage}
            onChange={(e) => applyCustomSlippage(e.target.value)}
            placeholder="Custom"
            inputMode="decimal"
            className="w-20 rounded border border-hl-border bg-hl-bg px-2 py-1 text-xs text-white outline-none"
          />
          <span className="text-xs text-hl-muted">%</span>
        </div>
        {slippageBps > HIGH_SLIPPAGE_BPS && (
          <p className="rounded border border-hl-red px-3 py-2 text-xs font-semibold text-hl-red">
            ⚠ Slippage is set to {(slippageBps / 100).toFixed(2)}%. You could lose a large share of
            this trade to price movement or sandwich attacks. Only continue if you know why you
            raised it.
          </p>
        )}
      </div>

      {/* ── Quote detail ── */}
      {buyAmount && !isLoading && (
        <dl className="flex flex-col gap-1 rounded-md border border-hl-border bg-hl-bg p-3 text-xs">
          <div className="flex justify-between">
            <dt className="text-hl-muted">Minimum received</dt>
            <dd className="font-mono text-white">
              {fmt(minBuyAmount, buyToken.decimals)} {buyToken.symbol}
            </dd>
          </div>
          {priceImpact && (
            <div className="flex justify-between">
              <dt className="text-hl-muted">Price impact</dt>
              <dd className="font-mono text-white">{priceImpact}%</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-hl-muted">Basis fee</dt>
            <dd className="text-right text-white">
              {integratorFee
                ? `${fmt(integratorFee.amount, sellToken.decimals)} ${sellToken.symbol} — taken from what you pay`
                : "No fee on this trade"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-hl-muted">Route</dt>
            <dd className="text-right text-white">{sources.length ? sources.join(" + ") : "—"}</dd>
          </div>
          {estimatedGas && (
            <div className="flex justify-between">
              <dt className="text-hl-muted">Estimated gas</dt>
              <dd className="font-mono text-white">{Number(estimatedGas).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      )}

      {noLiquidity && (
        <p className="text-xs text-hl-red">No liquidity available for this pair right now.</p>
      )}
      {quoteError && <p className="text-xs text-hl-red">{quoteError}</p>}

      {/* ── Approve step (before swap, ERC-20 only) ── */}
      {needsApproval && allowanceIssue && (
        <div className="flex flex-col gap-2 rounded-md border border-hl-border bg-hl-bg p-3">
          <p className="text-xs text-hl-text">
            Before this swap, you need to give the 0x AllowanceHolder contract permission to move{" "}
            <strong>
              {amount} {sellToken.symbol}
            </strong>{" "}
            from your wallet. We request exactly this amount — not unlimited — so the permission
            cannot be reused after this trade.
          </p>
          <p className="break-all font-mono text-[10px] text-hl-muted">
            Spender: {allowanceIssue.spender}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              approve(
                sellToken.address,
                allowanceIssue.spender as `0x${string}`,
                BigInt(sellAmountBase),
              )
            }
            style={{ backgroundColor: ACCENT }}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {status === "awaiting-approval-signature"
              ? "Confirm in wallet…"
              : status === "approval-pending"
                ? "Approving…"
                : `Approve ${sellToken.symbol}`}
          </button>
        </div>
      )}

      {/* ── Swap ── */}
      <button
        type="button"
        disabled={!onBnbChain || busy || needsApproval || !buyAmount || sellAmountBase === "0"}
        onClick={() =>
          swap({
            sellToken: sellToken.address,
            buyToken: buyToken.address,
            sellAmount: sellAmountBase,
            slippageBps,
          })
        }
        style={{ backgroundColor: ACCENT }}
        className="rounded-md px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!isConnected
          ? "Connect a wallet"
          : !onBnbChain
            ? "Switch to BNB Chain"
            : status === "quoting"
              ? "Getting a firm quote…"
              : status === "awaiting-signature"
                ? "Confirm in wallet…"
                : status === "pending"
                  ? "Swapping…"
                  : needsApproval
                    ? `Approve ${sellToken.symbol} first`
                    : "Swap"}
      </button>

      {/* ── Result ── */}
      {status === "rejected" && (
        <p className="text-xs text-hl-muted">{execError} No transaction was sent.</p>
      )}
      {status === "failed" && (
        <p className="text-xs text-hl-red">
          {execError}{" "}
          {swapHash && (
            <a
              href={BNB_CHAIN.txUrl(swapHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View on BscScan
            </a>
          )}
        </p>
      )}
      {status === "success" && swapHash && (
        <p className="text-xs" style={{ color: ACCENT }}>
          Swap confirmed.{" "}
          <a
            href={BNB_CHAIN.txUrl(swapHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View on BscScan
          </a>
        </p>
      )}
    </section>
  );
}
