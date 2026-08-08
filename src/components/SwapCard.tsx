"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import SafetyPanel from "@/components/SafetyPanel";
import { BNB_CHAIN } from "@/config/chains";
import {
  BNB_TOKENS,
  DEFAULT_BUY_TOKEN,
  DEFAULT_SELL_TOKEN,
  isNativeToken,
  type TokenInfo,
} from "@/config/tokens";
import { useSwapExecution } from "@/hooks/useSwapExecution";
import { useSwapQuote } from "@/hooks/useSwapQuote";
import { useTokenInfo } from "@/hooks/useTokenInfo";

const SLIPPAGE_PRESETS = [50, 100, 300]; // bps → 0.5%, 1%, 3%
const HIGH_SLIPPAGE_BPS = 500; // above 5% we shout
const NATIVE_GAS_BUFFER = parseUnits("0.005", 18); // leave room for gas on MAX

const UNVERIFIED_LABEL = "Address not checked by Basis";

/**
 * Shared row shape for anything label-then-figure. A two-column grid rather
 * than a space-between flex, so every value in the card starts at the same
 * x-position and the figures form a column instead of floating to their own
 * ragged right edge.
 */
const ROW = "grid grid-cols-[1fr_auto] items-baseline gap-x-3";
/** Labels are smaller and dimmer than the figures they describe. */
const LABEL = "text-bs-xs text-bs-n7";

/**
 * A figure and its unit.
 *
 * The unit sits in its own fixed-width column rather than trailing the number,
 * so the numerals right-align against a common edge and the decimal points
 * stack down the table. Rows with no unit still reserve the column, so they do
 * not pull their figure out of the stack. The space before the unit is real
 * text, which keeps the row reading as "0.001000 BNB" to a screen reader.
 */
function Figure({ value, unit }: { value: string; unit?: string }) {
  return (
    <dd className="text-right text-bs-sm">
      <span className="bs-num text-bs-n9">{value}</span>{" "}
      <span className="inline-block w-10 text-left text-bs-2xs text-bs-n7">{unit ?? ""}</span>
    </dd>
  );
}

function isCurated(address: string): boolean {
  return BNB_TOKENS.some((t) => t.address.toLowerCase() === address.toLowerCase());
}

function sameToken(a: TokenInfo, b: TokenInfo): boolean {
  return a.address.toLowerCase() === b.address.toLowerCase();
}

/** Shown wherever a non-curated token appears. Warning amber, never brand red. */
function UnverifiedBadge() {
  return (
    <span className="border border-bs-warn/50 px-1.5 py-px font-medium text-bs-2xs text-bs-warn">
      {UNVERIFIED_LABEL}
    </span>
  );
}

type TokenPickerProps = {
  title: string;
  tokens: TokenInfo[];
  onSelect: (token: TokenInfo) => void;
  onClose: () => void;
  onAddCustom: (token: TokenInfo) => void;
};

/** Searchable token picker: curated list first, then paste-any-address. */
function TokenPicker({ title, tokens, onSelect, onClose, onAddCustom }: TokenPickerProps) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  // Only treat the query as an address attempt once it starts with 0x, so
  // typing a symbol like "CAKE" never raises an address error.
  const addressQuery = trimmed.startsWith("0x") ? trimmed : "";
  const { token: resolved, isLoading, error } = useTokenInfo(addressQuery);

  const filtered = useMemo(() => {
    if (!trimmed) return tokens;
    const q = trimmed.toLowerCase();
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q),
    );
  }, [tokens, trimmed]);

  // Only offer to add a resolved token if it isn't already in the list.
  const alreadyListed = resolved
    ? tokens.some((t) => t.address.toLowerCase() === resolved.address.toLowerCase())
    : false;
  const showResolved = Boolean(resolved) && !alreadyListed;

  return (
    <div className="flex flex-col gap-2.5 border-bs-n4 border-t bg-bs-n2 px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-bs-base text-bs-n9">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-bs-n7 text-bs-xs transition-colors hover:text-bs-n9"
        >
          Close
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or symbol, or paste a 0x address"
        className="border border-bs-n4 bg-bs-n0 px-2.5 py-2 text-bs-n9 text-bs-sm outline-none placeholder:text-bs-n6 focus:border-bs-n5"
      />

      {/* ── Curated list ── */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-bs-2xs text-bs-n7 uppercase tracking-wider">
            Address checked by Basis
          </span>
          <span className="text-bs-2xs text-bs-n7">
            Basis has confirmed these contract addresses are the real ones for these tokens. That is
            all this means. It is not a judgement about whether a token is safe or worth buying.
          </span>
          <div className="mt-1 flex flex-col">
            {filtered.map((t) => (
              <button
                key={t.address}
                type="button"
                onClick={() => onSelect(t)}
                className="flex items-center justify-between gap-3 border-bs-n4 border-b px-1 py-2 text-left transition-colors last:border-b-0 hover:bg-bs-n3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex flex-wrap items-center gap-1.5 font-medium text-bs-base text-bs-n9">
                    {t.symbol}
                    {!isCurated(t.address) && <UnverifiedBadge />}
                  </span>
                  <span className="truncate text-bs-n7 text-bs-xs">{t.name}</span>
                </span>
                <span className="bs-num shrink-0 text-bs-2xs text-bs-n6">
                  {t.address.slice(0, 6)}…{t.address.slice(-4)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Address lookup ── */}
      {isLoading && <p className="text-bs-n7 text-bs-xs">Looking this token up on BNB Chain…</p>}
      {error && <p className="text-bs-alarm text-bs-xs">{error}</p>}

      {showResolved && resolved && (
        <div className="flex flex-col gap-2 border border-bs-warn/50 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-bs-base text-bs-n9">{resolved.symbol}</span>
            <UnverifiedBadge />
          </div>
          <span className="text-bs-n7 text-bs-xs">{resolved.name}</span>
          <dl className="flex flex-col gap-1">
            <div className={ROW}>
              <dt className={LABEL}>Decimals</dt>
              <Figure value={String(resolved.decimals)} />
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className={LABEL}>Contract</dt>
              <dd className="bs-num break-all text-bs-2xs text-bs-n8">{resolved.address}</dd>
            </div>
          </dl>
          <a
            href={BNB_CHAIN.addressUrl(resolved.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-bs-n8 text-bs-xs underline decoration-bs-n6 underline-offset-2 hover:text-bs-n9"
          >
            Check this contract on BscScan before trading
          </a>
          <button
            type="button"
            onClick={() => {
              onAddCustom(resolved);
              onSelect(resolved);
            }}
            className="border border-bs-warn/50 px-3 py-2 font-medium text-bs-warn text-bs-xs transition-colors hover:bg-bs-warn/10"
          >
            Use {resolved.symbol} anyway
          </button>
        </div>
      )}

      {!isLoading && !error && !showResolved && filtered.length === 0 && (
        <p className="text-bs-n7 text-bs-xs">
          No matches. Paste a token's contract address to add it yourself.
        </p>
      )}
    </div>
  );
}

export default function SwapCard() {
  const { address, isConnected, chainId } = useAccount();
  const queryClient = useQueryClient();
  const { openConnectModal } = useConnectModal();
  const [sellToken, setSellToken] = useState<TokenInfo>(DEFAULT_SELL_TOKEN);
  const [buyToken, setBuyToken] = useState<TokenInfo>(DEFAULT_BUY_TOKEN);
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100); // default 1%
  const [customSlippage, setCustomSlippage] = useState("");
  // Session-only. Deliberately not persisted — no localStorage.
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);
  const [picker, setPicker] = useState<"sell" | "buy" | null>(null);

  const onBnbChain = isConnected && chainId === BNB_CHAIN.chainId;

  /**
   * With no wallet the card is a working read-only preview: tokens, quotes,
   * fees and safety checks all resolve. Only the final button changes job, so
   * nothing moves on the page when a wallet connects.
   */
  const connectMode = !isConnected;

  const allTokens = useMemo(() => [...BNB_TOKENS, ...customTokens], [customTokens]);

  const addCustomToken = (token: TokenInfo) => {
    setCustomTokens((prev) =>
      prev.some((t) => t.address.toLowerCase() === token.address.toLowerCase())
        ? prev
        : [...prev, token],
    );
  };

  // One balance read that covers native and arbitrary ERC-20s alike.
  const { data: balanceData, queryKey: sellBalanceKey } = useBalance({
    address,
    token: isNativeToken(sellToken.address) ? undefined : sellToken.address,
    chainId: BNB_CHAIN.chainId,
    query: { enabled: Boolean(address) },
  });
  const balance = balanceData?.value;

  // Not displayed. Read so that the buy side has a cache entry to invalidate
  // after a swap — otherwise flipping the pair straight after a trade shows
  // the balance this token had *before* it.
  const { queryKey: buyBalanceKey } = useBalance({
    address,
    token: isNativeToken(buyToken.address) ? undefined : buyToken.address,
    chainId: BNB_CHAIN.chainId,
    query: { enabled: Boolean(address) },
  });

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
    zeroExFee,
    estimatedGas,
    priceImpact,
    sources,
    allowanceIssue,
    noLiquidity,
    sellTokenTax,
    buyTokenTax,
    isLoading,
    error: quoteError,
    refetch,
  } = useSwapQuote({
    sellToken: sellToken.address,
    buyToken: buyToken.address,
    sellAmount: sellAmountBase,
    taker: address,
    slippageBps,
    // Quotes are read-only, so a visitor without a wallet still gets live
    // prices and the fee breakdown. 0x only needs a taker for a firm quote,
    // which is fetched separately at swap time. A connected wallet on the
    // wrong chain is the one case worth suppressing: the numbers would not
    // be actionable and the button already says to switch.
    enabled: !isConnected || onBnbChain,
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

  /**
   * A confirmed swap moves both sides, so both cached balances are stale the
   * moment it lands. `status` becomes "success" only after the receipt is
   * mined and checked for revert, so this fires once per completed swap.
   */
  useEffect(() => {
    if (status !== "success") return;
    queryClient.invalidateQueries({ queryKey: sellBalanceKey });
    queryClient.invalidateQueries({ queryKey: buyBalanceKey });
  }, [status, queryClient, sellBalanceKey, buyBalanceKey]);

  const needsApproval = Boolean(allowanceIssue) && !isNativeToken(sellToken.address);
  const busy =
    status !== "idle" && status !== "success" && status !== "failed" && status !== "rejected";

  // ── Transfer taxes: any non-zero value means a fee-on-transfer token. ──
  const taxWarnings = useMemo(() => {
    const out: string[] = [];
    const check = (meta: typeof sellTokenTax, symbol: string) => {
      const buyTax = Number(meta?.buyTaxBps ?? "0");
      const sellTax = Number(meta?.sellTaxBps ?? "0");
      if (buyTax > 0) out.push(`${symbol} charges ${(buyTax / 100).toFixed(2)}% when you buy it`);
      if (sellTax > 0)
        out.push(`${symbol} charges ${(sellTax / 100).toFixed(2)}% when you sell it`);
    };
    check(sellTokenTax, sellToken.symbol);
    check(buyTokenTax, buyToken.symbol);
    return out;
  }, [sellTokenTax, buyTokenTax, sellToken.symbol, buyToken.symbol]);

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

  const handlePick = (side: "sell" | "buy", token: TokenInfo) => {
    const other = side === "sell" ? buyToken : sellToken;
    // Picking the token already on the other side swaps them instead of
    // producing an invalid same-token pair.
    if (sameToken(token, other)) {
      handleFlip();
    } else if (side === "sell") {
      setSellToken(token);
      setAmount("");
      reset();
    } else {
      setBuyToken(token);
      reset();
    }
    setPicker(null);
  };

  const applyCustomSlippage = (raw: string) => {
    setCustomSlippage(raw);
    const pct = Number(raw);
    if (Number.isFinite(pct) && pct > 0 && pct <= 100) setSlippageBps(Math.round(pct * 100));
  };

  const fmt = (v?: string, d = 18) => (v ? Number(formatUnits(BigInt(v), d)).toFixed(6) : "–");

  // Fee lines come straight from the live quote, never from a hardcoded rate.
  // A fee can be denominated in either side of the trade, so resolve the fee
  // token before formatting; if it resolves to neither, omit the line rather
  // than print a number scaled by the wrong decimals.
  const resolveFeeToken = (addr?: string): TokenInfo | null => {
    if (!addr) return null;
    const a = addr.toLowerCase();
    if (a === sellToken.address.toLowerCase()) return sellToken;
    if (a === buyToken.address.toLowerCase()) return buyToken;
    return null;
  };

  const feeParts = (
    fee: { amount?: string; token?: string } | null,
  ): { value: string; unit: string } | null => {
    if (!fee?.amount) return null;
    const info = resolveFeeToken(fee.token);
    if (!info) return null;
    return { value: fmt(fee.amount, info.decimals), unit: info.symbol };
  };

  const basisFee = feeParts(integratorFee);
  const zeroExFeePart = feeParts(zeroExFee);

  const tokenButton = (side: "sell" | "buy", token: TokenInfo) => (
    <button
      type="button"
      onClick={() => setPicker(picker === side ? null : side)}
      className="flex shrink-0 items-center gap-1.5 border border-bs-n4 bg-bs-n2 px-2 py-1.5 font-medium text-bs-base text-bs-n9 transition-colors hover:bg-bs-n3"
    >
      {token.symbol}
      <span className="text-bs-2xs text-bs-n7">▾</span>
    </button>
  );

  return (
    /* One container. Sections are separated by hairlines rather than by nested
       boxes, so the card reads as a single instrument instead of a stack of
       panels. Sharp corners throughout: no gradient, no shadow, no radius. */
    <section className="border border-bs-n4 bg-bs-n1">
      <div className="flex items-baseline justify-between gap-3 border-bs-n4 border-b px-3.5 py-2.5">
        <h2 className="font-semibold text-bs-md text-bs-n9">Swap</h2>
        <span className="text-bs-n7 text-bs-xs">via 0x · BNB Chain</span>
      </div>

      {/* ── Input ── */}
      <div className="px-3.5 pt-3 pb-3">
        <div className={`${ROW} mb-2`}>
          <span className={LABEL}>You pay</span>
          <span className={LABEL}>
            Balance:{" "}
            <span className="bs-num text-bs-n8">
              {balance !== undefined
                ? Number(formatUnits(balance, sellToken.decimals)).toFixed(6)
                : "–"}
            </span>
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
            className="bs-num min-w-0 flex-1 bg-transparent text-bs-n9 text-bs-num-lg outline-none placeholder:text-bs-n6"
          />
          <button
            type="button"
            onClick={handleMax}
            className="shrink-0 border border-bs-n4 px-2 py-1.5 font-medium text-bs-2xs text-bs-n7 tracking-wider transition-colors hover:bg-bs-n3 hover:text-bs-n9"
          >
            MAX
          </button>
          {tokenButton("sell", sellToken)}
        </div>
        {!isCurated(sellToken.address) && (
          <div className="mt-2">
            <UnverifiedBadge />
          </div>
        )}
      </div>

      {picker === "sell" && (
        <TokenPicker
          title="Choose a token to pay with"
          tokens={allTokens}
          onSelect={(t) => handlePick("sell", t)}
          onClose={() => setPicker(null)}
          onAddCustom={addCustomToken}
        />
      )}

      {/* The flip control sits on the rule dividing the two sides, which is
          what it acts on. */}
      <div className="relative h-0 border-bs-n4 border-t">
        <button
          type="button"
          onClick={handleFlip}
          aria-label="Flip tokens"
          className="-translate-x-1/2 -translate-y-1/2 absolute top-0 left-1/2 border border-bs-n4 bg-bs-n1 px-2 py-1 text-bs-n8 text-bs-xs transition-colors hover:bg-bs-n3 hover:text-bs-n9"
        >
          ↓↑
        </button>
      </div>

      {/* ── Output ── */}
      <div className="px-3.5 pt-5 pb-3">
        <div className="mb-2">
          <span className={LABEL}>You receive (estimated)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="bs-num min-w-0 flex-1 truncate text-bs-n9 text-bs-num-lg">
            {isLoading ? "…" : fmt(buyAmount, buyToken.decimals)}
          </span>
          {tokenButton("buy", buyToken)}
        </div>
        {!isCurated(buyToken.address) && (
          <div className="mt-2">
            <UnverifiedBadge />
          </div>
        )}
      </div>

      {picker === "buy" && (
        <TokenPicker
          title="Choose a token to receive"
          tokens={allTokens}
          onSelect={(t) => handlePick("buy", t)}
          onClose={() => setPicker(null)}
          onAddCustom={addCustomToken}
        />
      )}

      {/* ── Transfer-tax warning ── */}
      {taxWarnings.length > 0 && (
        <div className="flex flex-col gap-1 border-bs-n4 border-t bg-bs-warn/5 px-3.5 py-2.5 text-bs-warn text-bs-xs">
          <span className="font-semibold">This token takes a cut of every transfer</span>
          {taxWarnings.map((w) => (
            <span key={w}>· {w}</span>
          ))}
          <span className="text-bs-warn/80">
            You will receive less than the quote shows, and the swap may fail unless slippage covers
            the tax.
          </span>
        </div>
      )}

      {/* ── Settings ── */}
      <div className="flex flex-col gap-2 border-bs-n4 border-t px-3.5 py-3">
        <span className={LABEL}>Max slippage</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {SLIPPAGE_PRESETS.map((bps) => (
            <button
              key={bps}
              type="button"
              onClick={() => {
                setSlippageBps(bps);
                setCustomSlippage("");
              }}
              className={`bs-num border px-2.5 py-1 text-bs-xs transition-colors ${
                slippageBps === bps
                  ? "border-bs-n5 bg-bs-n5 text-bs-n9"
                  : "border-bs-n4 text-bs-n7 hover:bg-bs-n3 hover:text-bs-n9"
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
            className="bs-num w-[74px] border border-bs-n4 bg-bs-n0 px-2 py-1 text-bs-n9 text-bs-xs outline-none placeholder:font-ui placeholder:text-bs-n6 focus:border-bs-n5"
          />
          <span className="text-bs-n7 text-bs-xs">%</span>
        </div>
        {slippageBps > HIGH_SLIPPAGE_BPS && (
          <p className="border border-bs-alarm/50 px-2.5 py-2 font-medium text-bs-alarm text-bs-xs">
            ⚠ Slippage is set to {(slippageBps / 100).toFixed(2)}%. You could lose a large share of
            this trade to price movement or sandwich attacks. Only continue if you know why you
            raised it.
          </p>
        )}
      </div>

      {/* ── Quote detail ──
          A table: one label column, one figure column, every value tabular and
          right-aligned so decimal points stack. */}
      {buyAmount && !isLoading && (
        <dl className="flex flex-col gap-1.5 border-bs-n4 border-t px-3.5 py-3">
          <div className={ROW} data-fee-row="minimum-received">
            <dt className={LABEL}>Minimum received</dt>
            <Figure value={fmt(minBuyAmount, buyToken.decimals)} unit={buyToken.symbol} />
          </div>
          {priceImpact && (
            <div className={ROW} data-fee-row="price-impact">
              <dt className={LABEL}>Price impact</dt>
              <Figure value={priceImpact} unit="%" />
            </div>
          )}
          {basisFee && (
            <div className={ROW} data-fee-row="basis-fee">
              <dt className={LABEL}>Basis fee</dt>
              <Figure value={basisFee.value} unit={basisFee.unit} />
            </div>
          )}
          {zeroExFeePart && (
            <div className={ROW} data-fee-row="zeroex-fee">
              <dt className={LABEL}>0x protocol fee</dt>
              <Figure value={zeroExFeePart.value} unit={zeroExFeePart.unit} />
            </div>
          )}
          <div className={ROW} data-fee-row="route">
            <dt className={LABEL}>Route</dt>
            {/* Not a figure, so it stays in the interface face. */}
            <dd className="text-right text-bs-n8 text-bs-sm">
              {sources.length ? sources.join(" + ") : "–"}
            </dd>
          </div>
          {estimatedGas && (
            <div className={ROW} data-fee-row="estimated-gas">
              <dt className={LABEL}>Estimated gas</dt>
              <Figure value={Number(estimatedGas).toLocaleString()} />
            </div>
          )}
        </dl>
      )}

      {noLiquidity && (
        <p className="border-bs-n4 border-t px-3.5 py-2.5 text-bs-alarm text-bs-xs">
          No liquidity available for this pair right now.
        </p>
      )}
      {quoteError && (
        <p className="border-bs-n4 border-t px-3.5 py-2.5 text-bs-alarm text-bs-xs">{quoteError}</p>
      )}

      {/* ── Approve step (before swap, ERC-20 only) ── */}
      {needsApproval && allowanceIssue && (
        <div className="flex flex-col gap-2 border-bs-n4 border-t px-3.5 py-3">
          <p className="text-bs-n8 text-bs-xs">
            Before this swap, you need to give the 0x AllowanceHolder contract permission to move{" "}
            <strong className="bs-num font-medium text-bs-n9">
              {amount} {sellToken.symbol}
            </strong>{" "}
            from your wallet. We request exactly this amount, not unlimited, so the permission
            cannot be reused after this trade.
          </p>
          <p className="bs-num break-all text-bs-2xs text-bs-n6">
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
            className="border border-bs-n5 bg-bs-n2 px-4 py-2 font-medium text-bs-n9 text-bs-sm transition-colors hover:bg-bs-n3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === "awaiting-approval-signature"
              ? "Confirm in wallet…"
              : status === "approval-pending"
                ? "Approving…"
                : `Approve ${sellToken.symbol}`}
          </button>
        </div>
      )}

      {/* ── Safety checks: always shown for the selected buy token. Not gated
          on curation, on a quote, or on an amount being entered. ── */}
      <SafetyPanel address={buyToken.address} />

      {/* ── Action ── the only part of this card that needs a wallet. ── */}
      <div className="border-bs-n4 border-t px-3.5 py-3">
        <button
          type="button"
          disabled={
            connectMode
              ? false
              : !onBnbChain || busy || needsApproval || !buyAmount || sellAmountBase === "0"
          }
          onClick={
            connectMode
              ? () => openConnectModal?.()
              : () =>
                  swap({
                    sellToken: sellToken.address,
                    buyToken: buyToken.address,
                    sellAmount: sellAmountBase,
                    slippageBps,
                  })
          }
          className="w-full bg-bs-brand px-4 py-2.5 font-semibold text-bs-base text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {connectMode
            ? "Connect wallet"
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
          <p className="mt-2 text-bs-n7 text-bs-xs">{execError} No transaction was sent.</p>
        )}
        {status === "failed" && (
          <p className="mt-2 text-bs-alarm text-bs-xs">
            {execError}{" "}
            {swapHash && (
              <a
                href={BNB_CHAIN.txUrl(swapHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                View on BscScan
              </a>
            )}
          </p>
        )}
        {status === "success" && swapHash && (
          <p className="mt-2 text-bs-success text-bs-xs">
            Swap confirmed.{" "}
            <a
              href={BNB_CHAIN.txUrl(swapHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              View on BscScan
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
