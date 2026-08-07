"use client";

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

const ACCENT = "#E5341F";
const SLIPPAGE_PRESETS = [50, 100, 300]; // bps → 0.5%, 1%, 3%
const HIGH_SLIPPAGE_BPS = 500; // above 5% we shout
const NATIVE_GAS_BUFFER = parseUnits("0.005", 18); // leave room for gas on MAX

const UNVERIFIED_LABEL = "Address not checked by Basis";

function isCurated(address: string): boolean {
  return BNB_TOKENS.some((t) => t.address.toLowerCase() === address.toLowerCase());
}

function sameToken(a: TokenInfo, b: TokenInfo): boolean {
  return a.address.toLowerCase() === b.address.toLowerCase();
}

/** Shown wherever a non-curated token appears. Warning amber, never brand red. */
function UnverifiedBadge() {
  return (
    <span className="rounded border border-hl-warning px-1.5 py-0.5 text-[10px] font-semibold text-hl-warning">
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
    <div className="flex flex-col gap-3 rounded-md border border-hl-border bg-hl-bg p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{title}</span>
        <button type="button" onClick={onClose} className="text-xs text-hl-muted hover:text-white">
          Close
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or symbol, or paste a 0x address"
        className="rounded border border-hl-border bg-hl-input-bg px-3 py-2 text-sm text-white outline-none"
      />

      {/* ── Curated list ── */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-hl-muted">
            Address checked by Basis
          </span>
          <span className="text-[10px] leading-snug text-hl-muted">
            Basis has confirmed these contract addresses are the real ones for these tokens. That is
            all this means. It is not a judgement about whether a token is safe or worth buying.
          </span>
          {filtered.map((t) => (
            <button
              key={t.address}
              type="button"
              onClick={() => onSelect(t)}
              className="flex items-center justify-between rounded px-2 py-2 text-left hover:bg-hl-card"
            >
              <span className="flex flex-col">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  {t.symbol}
                  {!isCurated(t.address) && <UnverifiedBadge />}
                </span>
                <span className="text-xs text-hl-muted">{t.name}</span>
              </span>
              <span className="font-mono text-[10px] text-hl-muted">
                {t.address.slice(0, 6)}…{t.address.slice(-4)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Address lookup ── */}
      {isLoading && <p className="text-xs text-hl-muted">Looking this token up on BNB Chain…</p>}
      {error && <p className="text-xs text-hl-red">{error}</p>}

      {showResolved && resolved && (
        <div className="flex flex-col gap-2 rounded border border-hl-warning p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{resolved.symbol}</span>
            <UnverifiedBadge />
          </div>
          <span className="text-xs text-hl-muted">{resolved.name}</span>
          <dl className="flex flex-col gap-0.5 text-[11px]">
            <div className="flex justify-between">
              <dt className="text-hl-muted">Decimals</dt>
              <dd className="font-mono text-white">{resolved.decimals}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-hl-muted">Contract</dt>
              <dd className="truncate font-mono text-white">{resolved.address}</dd>
            </div>
          </dl>
          <a
            href={BNB_CHAIN.addressUrl(resolved.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: ACCENT }}
          >
            Check this contract on BscScan before trading
          </a>
          <button
            type="button"
            onClick={() => {
              onAddCustom(resolved);
              onSelect(resolved);
            }}
            className="rounded border border-hl-warning px-3 py-2 text-xs font-semibold text-hl-warning"
          >
            Use {resolved.symbol} anyway
          </button>
        </div>
      )}

      {!isLoading && !error && !showResolved && filtered.length === 0 && (
        <p className="text-xs text-hl-muted">
          No matches. Paste a token's contract address to add it yourself.
        </p>
      )}
    </div>
  );
}

export default function SwapCard() {
  const { address, isConnected, chainId } = useAccount();
  const [sellToken, setSellToken] = useState<TokenInfo>(DEFAULT_SELL_TOKEN);
  const [buyToken, setBuyToken] = useState<TokenInfo>(DEFAULT_BUY_TOKEN);
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(100); // default 1%
  const [customSlippage, setCustomSlippage] = useState("");
  // Session-only. Deliberately not persisted — no localStorage.
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);
  const [picker, setPicker] = useState<"sell" | "buy" | null>(null);

  const onBnbChain = isConnected && chainId === BNB_CHAIN.chainId;

  const allTokens = useMemo(() => [...BNB_TOKENS, ...customTokens], [customTokens]);

  const addCustomToken = (token: TokenInfo) => {
    setCustomTokens((prev) =>
      prev.some((t) => t.address.toLowerCase() === token.address.toLowerCase())
        ? prev
        : [...prev, token],
    );
  };

  // One balance read that covers native and arbitrary ERC-20s alike.
  const { data: balanceData } = useBalance({
    address,
    token: isNativeToken(sellToken.address) ? undefined : sellToken.address,
    chainId: BNB_CHAIN.chainId,
    query: { enabled: Boolean(address) },
  });
  const balance = balanceData?.value;

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

  const fmt = (v?: string, d = 18) => (v ? Number(formatUnits(BigInt(v), d)).toFixed(6) : "—");

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

  const feeText = (fee: { amount?: string; token?: string } | null): string | null => {
    if (!fee?.amount) return null;
    const info = resolveFeeToken(fee.token);
    if (!info) return null;
    return `${fmt(fee.amount, info.decimals)} ${info.symbol}`;
  };

  const basisFeeText = feeText(integratorFee);
  const zeroExFeeText = feeText(zeroExFee);

  const tokenButton = (side: "sell" | "buy", token: TokenInfo) => (
    <button
      type="button"
      onClick={() => setPicker(picker === side ? null : side)}
      className="flex shrink-0 items-center gap-1 rounded bg-hl-input-bg px-2 py-1 text-sm text-white"
    >
      {token.symbol}
      <span className="text-[10px] text-hl-muted">▾</span>
    </button>
  );

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
          {tokenButton("sell", sellToken)}
        </div>
        {!isCurated(sellToken.address) && (
          <div>
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
          {tokenButton("buy", buyToken)}
        </div>
        {!isCurated(buyToken.address) && (
          <div>
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
        <div className="flex flex-col gap-1 rounded border border-hl-warning px-3 py-2 text-xs text-hl-warning">
          <span className="font-semibold">This token takes a cut of every transfer</span>
          {taxWarnings.map((w) => (
            <span key={w}>· {w}</span>
          ))}
          <span>
            You will receive less than the quote shows, and the swap may fail unless slippage covers
            the tax.
          </span>
        </div>
      )}

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
          {basisFeeText && (
            <div className="flex justify-between">
              <dt className="text-hl-muted">Basis fee</dt>
              <dd className="text-right text-white">{basisFeeText}</dd>
            </div>
          )}
          {zeroExFeeText && (
            <div className="flex justify-between">
              <dt className="text-hl-muted">0x protocol fee</dt>
              <dd className="text-right text-white">{zeroExFeeText}</dd>
            </div>
          )}
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

      {/* ── Safety checks: always shown for the selected buy token. Not gated
          on curation, on a quote, or on an amount being entered. ── */}
      <SafetyPanel address={buyToken.address} />

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
